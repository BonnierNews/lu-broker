"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const config = require("exp-config");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");
const activeHandlers = require("./active-handlers");

function buildTriggerHandler(recipes, useParentCorrelationId) {
  async function handleTriggerMessage(source, meta, notify) {
    const context = buildContext(source, meta);
    const {logger, routingKey} = context;
    logger.info(`Got trigger ${JSON.stringify(source)} on ${routingKey}`);

    if (isRedelivered(meta)) {
      logger.error("Message has been re-delivered, this is probably an error");
      if (config.brokerRejectRedelivered) {
        return rejectMessage(
          broker.triggersQueueName,
          `Message redelivered, rejecting trigger message on routing key: ${routingKey}, message: ${JSON.stringify(
            source
          )}`,
          source,
          context,
          meta,
          notify
        );
      }
    }

    try {
      activeHandlers.inc();
      const fn =
        recipes.triggerHandler(routingKey) ||
        generic(useParentCorrelationId || recipes.genericTriggerUsesParentCorrelationId(routingKey));

      const calculatedResponse = await fn(source, context);
      const responses = calculatedResponse
        ? (Array.isArray(calculatedResponse) && calculatedResponse) || [calculatedResponse]
        : [];
      if (responses.length === 0) logger.info(`Trigger nothing for source ${JSON.stringify(source)}`);
      for (const response of responses) {
        if (response.type !== "trigger") throw new Error(`Invalid format for response ${JSON.stringify(response)}`);
        if (!response.id) throw new Error(`Invalid format for response ${JSON.stringify(response)}`);

        const [namespace, name] = response.id.split(".");
        const first = recipes.first(namespace, name);
        if (!first) throw new Error(`Unknown event ${response.id}`);

        const newMeta = {...(source.meta || {})};
        // This format is superstrange but:
        // if you decide to put correlationId directly on the message instead of under "meta",
        // let it override the correlationId given in meta
        newMeta.correlationId = response.correlationId || context.correlationId;

        const parentCorrelationId = response.correlationId
          ? context.correlationId
          : meta && meta.properties && meta.properties.headers && meta.properties.headers["x-parent-correlation-id"];

        if (parentCorrelationId) {
          newMeta.parentCorrelationId = parentCorrelationId;
        }
        // get some message meta stuff from the headers
        const notifyProcessed =
          meta && meta.properties && meta.properties.headers && meta.properties.headers["x-notify-processed"];
        newMeta.notifyProcessed = notifyProcessed;
        const message = {
          type: namespace,
          id: uuid.v4(),
          data: [],
          meta: newMeta,
          source: response.source
        };

        await broker.crd.publishMessage(
          first,
          message,
          {
            correlationId: newMeta.correlationId,
            replyTo: recipes.next(first)
          },
          context.debugMeta
        );
        logger.info(`Triggered ${first} from ${routingKey} with source ${JSON.stringify(source)}`);
      }
    } catch (err) {
      return rejectMessage(broker.triggersQueueName, err, source, context, meta, notify);
    } finally {
      activeHandlers.dec();
    }

    return notify.ack();
  }

  return handleTriggerMessage;
}

function generic(useParentCorrelationId) {
  return (source, context) => {
    const {routingKey} = context;
    const [, namespace, name] = routingKey.split(".");
    const res = {
      type: "trigger",
      id: `${namespace}.${name}`,
      source: {
        id: source.id,
        type: source.type,
        attributes: source.attributes,
        meta: source.meta,
        relationships: source.relationships, // legacy compatability for v1 entities
        externalIds: source.externalIds // legacy compatability for v1 entities
      }
    };
    if (useParentCorrelationId) res.correlationId = `${context.correlationId}:${uuid.v4()}`;
    return res;
  };
}

function isRedelivered(meta) {
  return Boolean(meta && meta.fields && meta.fields.redelivered);
}

module.exports = buildTriggerHandler;
