"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");

function buildTriggerHandler(recipes) {
  async function handleTriggerMessage(source, meta, notify) {
    const context = buildContext(source, meta);
    const {logger, routingKey} = context;
    logger.info(`Got ${JSON.stringify(source)} on ${routingKey}`);

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
      await broker.publishMessage(first, message, {
        messageId: uuid.v4(),
        correlationId: context.correlationId,
        replyTo: recipes.next(first)
      });
      logger.info(`Triggered ${first} from ${routingKey} with source ${JSON.stringify(source)}`);
    } catch (err) {
      return rejectMessage(err, routingKey, source, context, notify);
    }

    return notify.ack();
  }

  return handleTriggerMessage;
}

module.exports = buildTriggerHandler;