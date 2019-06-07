"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");

function buildTriggerHandler(recipes) {
  async function handleTriggerMessage(source, meta, notify) {
    const context = buildContext(source, meta);
    const {logger, routingKey} = context;
    logger.info(`Got trigger ${JSON.stringify(source)} on ${routingKey}`);

    try {
      const fn = recipes.triggerHandler(routingKey) || generic;

      const response = fn(source, context);
      if (response.type !== "trigger") throw new Error(`Invalid format for response ${JSON.stringify(response)}`);
      if (!response.id) throw new Error(`Invalid format for response ${JSON.stringify(response)}`);

      const [namespace, name] = response.id.split(".");
      const first = recipes.first(namespace, name);
      if (!first) throw new Error(`Unknown event ${response.id}`);
      const message = {
        type: "event",
        id: uuid.v4(),
        data: [],
        meta: {correlationId: context.correlationId},
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
    } catch (err) {
      return rejectMessage(err, source, context, meta, notify);
    }

    return notify.ack();
  }

  return handleTriggerMessage;
}

function generic(source, context) {
  const {routingKey} = context;
  const [, namespace, name] = routingKey.split(".");
  return {
    type: "trigger",
    id: `${namespace}.${name}`,
    source
  };
}

module.exports = buildTriggerHandler;
