"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");
const activeHandlers = require("./active-handlers");
const {isShuttingDown} = require("./graceful-shutdown");

function buildTriggerHandler(recipes, useParentCorrelationId) {
  async function handleTriggerMessage(source, meta, notify) {
    const context = buildContext(source, meta);
    const {logger, routingKey} = context;
    logger.info(`Got trigger ${JSON.stringify(source)} on ${routingKey}`);

    if (isShuttingDown()) {
      logger.warning(`Shut down in progress, requeuing message on ${routingKey}, message: ${JSON.stringify(source)}`);
      return notify.nack(true);
    }

    try {
      activeHandlers.inc();
      const fn =
        recipes.triggerHandler(routingKey) ||
        generic(useParentCorrelationId || recipes.genericTriggerUsesParentCorrelationId(routingKey));

      const calculatedResponse = fn(source, context);
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

        const newMeta = {correlationId: response.correlationId || context.correlationId};
        if (response.correlationId) newMeta.parentCorrelationId = context.correlationId;

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
            correlationId: context.correlationId,
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
      source: {id: source.id, type: source.type, attributes: source.attributes}
    };
    if (useParentCorrelationId) res.correlationId = `${context.correlationId}:${uuid.v4()}`;
    return res;
  };
}

module.exports = buildTriggerHandler;
