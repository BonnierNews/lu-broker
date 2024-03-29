"use strict";

const broker = require("./broker");
const config = require("exp-config");
const retryMessage = require("./retry-message");
const rejectMessage = require("./reject-message");
const buildContext = require("./context");
const { getReplyToKey } = require("./get-routing-key");
const activeHandlers = require("./active-handlers");
const jobStorage = require("./job-storage");

function buildFlowHandler(recipes) {
  async function handleFlowMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const { logger, routingKey } = context;
    if (isEmptyMessage(message)) {
      logger.error("Received empty message on routing key:", routingKey, "meta:", meta, "message %j", message);
      return notify.ack();
    }

    if (isRedelivered(meta)) {
      logger.error("Message has been re-delivered, this is probably an error");
      if (config.brokerRejectRedelivered) {
        return rejectMessage(
          broker.lambdasQueueName,
          `Message redelivered, rejecting message on routing key: ${routingKey}, check if the message is processed, If not rerun. message: ${JSON.stringify(
            message
          )}`,
          message,
          context,
          meta,
          notify
        );
      }
    }

    const responseKey = getReplyToKey(meta);
    if (!responseKey) {
      logger.info("Message processed, acking");
      return notify.ack();
    }

    const handlerFunction = recipes.handler(routingKey);

    if (!handlerFunction) {
      return rejectMessage(
        broker.lambdasQueueName,
        `No handler for routing key: ${routingKey}, message: ${JSON.stringify(message)}`,
        message,
        context,
        meta,
        notify
      );
    }
    logger.info(
      `Received message on routing key: ${routingKey}, calling listener ${
        handlerFunction.name
      }, responseKey: ${responseKey} message ${JSON.stringify(message)}, rabbitMeta: ${JSON.stringify({
        fields: meta.fields,
        properties: meta.properties,
      })}`
    );

    try {
      try {
        activeHandlers.inc();
        const response = await handlerFunction(message, context);
        assertValidResponse(response, message, context);
        if (response && response.type === "trigger") {
          await triggerSubMessages(response, responseKey, message, meta, context);
          if (!jobStorage) {
            // when all the sources are published, if no jobStorage then we just resume the flow.
            await publish(responseKey, buildMessage(message, response, context), meta, context);
          }
        } else {
          await publish(responseKey, buildMessage(message, response, context), meta, context);
        }
      } catch (err) {
        const unrecoverableHandler = recipes.unrecoverableHandler(routingKey);
        if (err.unrecoverable && unrecoverableHandler) {
          logger.info(
            `Got unrecoverable message on routingKey ${routingKey}, calling handler ${unrecoverableHandler.name}`
          );
          const unrecoverableResponse = await unrecoverableHandler(err, message, context);
          await publish(
            `${routingKey}.unrecoverable.processed`,
            buildUnrecoverableMessage(message, unrecoverableResponse, context),
            meta,
            context
          );
        } else if (err.caseCreated) {
          await publish(
            `${routingKey}.sfdc-case-created.processed`,
            buildCaseCreatedMessage(message, err.caseCreated, context),
            meta,
            context
          );
        } else {
          throw err;
        }
      }
      return notify.ack();
    } catch (err) {
      if (err.rejected || err.unrecoverable) {
        return rejectMessage(broker.lambdasQueueName, err, message, context, meta, notify);
      }
      return retryMessage(err, message, context, notify);
    } finally {
      activeHandlers.dec();
    }
  }

  async function triggerSubMessages(response, responseKey, message, meta, context) {
    const sources = [].concat(response.source);
    if (jobStorage) {
      // If jobStorage is defined, we store the parent job and keep track of all the children.
      await jobStorage.storeParent({
        responseKey,
        childCount: sources.length,
        message: buildMessage(message, response, context, sources.length > 1 ? sources.length : undefined),
        context,
      });
    }

    const [ namespace ] = response.id.split(".");
    if (namespace === "sub-sequence") {
      return await putOnWorkerQueue(sources, response, meta, context);
    }

    sources.forEach(async (source, index) => {
      if (!meta.properties.headers) meta.properties.headers = {};
      meta.properties.headers["x-notify-processed"] = `${context.routingKey}:${context.correlationId}`;
      meta.properties.correlationId = `${context.correlationId}:${index}`;
      meta.properties.headers["x-parent-correlation-id"] = context.correlationId;
      await publish(`trigger.${response.id}`, source, meta, context);
    });
  }

  async function putOnWorkerQueue(sources, response, meta, context) {
    return await Promise.all(
      sources.map((source, index) => {
        const headers = meta.properties.headers || {};
        delete headers["x-routing-key"];

        return broker.wq.publishMessage(
          `wq.trigger.${response.id}`,
          source,
          {
            correlationId: `${context.correlationId}:${index}`,
            replyTo: `trigger.${response.id}`,
            headers: {
              ...headers,
              "x-notify-processed": `${context.routingKey}:${context.correlationId}`,
              "x-parent-correlation-id": context.correlationId,
            },
          },
          context.debugMeta
        );
      })
    );
  }

  async function publish(responseKey, message, meta, context) {
    if (!message) return;
    const headers = meta.properties.headers || {};
    delete headers["x-routing-key"];

    return await broker.crd.publishMessage(
      responseKey,
      message,
      {
        correlationId: meta.properties.correlationId || context.correlationId,
        headers,
        replyTo: recipes.next(responseKey),
      },
      context.debugMeta
    );
  }
  return handleFlowMessage;
}
function buildUnrecoverableMessage(message, response, context) {
  return buildMessage(message, response, { ...context, routingKey: `${context.routingKey}.unrecoverable` });
}

function buildCaseCreatedMessage(message, caseId, context) {
  return buildMessage(
    message,
    { type: "sfdc__case", id: caseId },
    {
      ...context,
      routingKey: `${context.routingKey}.sfdc-case-created`,
    }
  );
}

function buildMessage(message, response, context, times) {
  if (!message.data) {
    message.data = [];
  }

  const iterate = Array.isArray(response) ? response : [ response ];

  iterate.filter(Boolean).forEach((append) => {
    const { id, type } = append;
    const row = {
      id,
      type,
      occurredAt: new Date().toJSON(),
      key: context.routingKey,
    };
    if (times) {
      row.times = times;
    }

    message.data.push(row);
  });

  return message;
}
function isEmptyMessage(message) {
  return !message || (!message.data && !message.attributes && !message.source);
}

function isRedelivered(meta) {
  return Boolean(meta && meta.fields && meta.fields.redelivered);
}

function assertValidResponse(response, message, context) {
  if (response && isInvalid(response, message)) {
    const error = new Error(
      `Invalid response on routing key: ${context.routingKey} response: ${JSON.stringify(response)}`
    );
    error.rejected = true;
    throw error;
  }
}

// messages are considered invalid if:
// * they are of type "event";
// * they are the same as the incoming message
// * they do not have id AND type;
// * they are a trigger for sub sequences and the sequence triggered does not have namespace sub-sequence
function isInvalid(response, message) {
  if (response === message || response.type === "event") return true;
  if (response.type === "trigger" && Array.isArray(response.source)) {
    const [ namespace ] = response.id.split(".");
    if (namespace !== "sub-sequence") {
      return true;
    }
  }
  const validator = Array.isArray(response) ? response : [ response ];
  return validator.find((msg) => !(isNotNullUndefinedOrEmpty(msg.id) && msg.type));
}

function isNotNullUndefinedOrEmpty(x) {
  return typeof x === "number" || Boolean(x);
}

module.exports = buildFlowHandler;
