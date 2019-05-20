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
      const [, namespace, name] = routingKey.split(".");

      const first = recipes.first(namespace, name);
      const message = {
        type: "event",
        id: uuid.v4(),
        data: [],
        meta: {correlationId: context.correlationId},
        source
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

module.exports = buildTriggerHandler;
