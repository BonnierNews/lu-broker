"use strict";

const broker = require("./broker");
const retryMessage = require("./retry-message");
const rejectMessage = require("./reject-message");
const buildContext = require("./context");
const {getReplyToKey} = require("./get-routing-key");

function buildFlowHandler(recipes) {
  async function handleFlowMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const {logger, routingKey} = context;
    if (isEmptyMessage(message)) {
      logger.error("Received empty message on routing key:", routingKey, "meta:", meta, "message %j", message);
      return notify.ack();
    }

    const responseKey = getReplyToKey(meta);
    if (!responseKey) {
      logger.info("Message processed, acking");
      return notify.ack();
    }

    const handlerFunction = recipes.handler(routingKey);

    if (!handlerFunction) {
      return rejectMessage(
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
        properties: meta.properties
      })}`
    );

    try {
      try {
        const response = await handlerFunction(message, context);
        assertValidResponse(response, message, context);
        if (response && response.type === "trigger") {
          await publish(`trigger.${response.id}`, response.source, meta, context);
        }
        await publish(responseKey, buildMessage(message, response, context), meta, context);
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
        } else {
          throw err;
        }
      }
      return notify.ack();
    } catch (err) {
      if (err.rejected || err.unrecoverable) {
        return rejectMessage(err, message, context, meta, notify);
      }
      return retryMessage(err, message, context, notify);
    }
  }

  async function publish(responseKey, message, meta, context) {
    if (!message) return;
    const headers = meta.properties.headers || {};
    delete headers["x-routing-key"];
    return await broker.crd.publishMessage(
      responseKey,
      message,
      {
        correlationId: context.correlationId,
        headers,
        replyTo: recipes.next(responseKey)
      },
      context.debugMeta
    );
  }
  return handleFlowMessage;
}

function buildUnrecoverableMessage(message, response, context) {
  return buildMessage(message, response, {...context, routingKey: `${context.routingKey}.unrecoverable`});
}

function buildMessage(message, response, context) {
  if (!message.data) {
    message.data = [];
  }

  const iterate = Array.isArray(response) ? response : [response];

  iterate.filter(Boolean).forEach((append) => {
    const {id, type} = append;
    message.data.push({
      id,
      type,
      occurredAt: new Date().toJSON(),
      key: context.routingKey
    });
  });

  if (message.meta.correlationId !== context.correlationId) {
    context.logger.warning("Correlation in new message %j and orig message %j differs!", message, context.message);
  }
  return message;
}
function isEmptyMessage(message) {
  return !message || (!message.data && !message.attributes && !message.source);
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
function isInvalid(response, message) {
  if (response === message || response.type === "event") return true;
  const validator = Array.isArray(response) ? response : [response];
  return validator.find((msg) => !(msg.id && msg.type));
}

module.exports = buildFlowHandler;
