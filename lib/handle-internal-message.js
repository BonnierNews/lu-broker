"use strict";

const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");

function triggerFn(message, context) {
  const {source} = message.attributes;
  source.meta = {
    ...source.meta,
    correlationId: `${context.correlationId}:0`,
    parentCorrelationId: context.correlationId,
    notifyProcessed: true
  };
  // save message + routing-key

  return message;
}

function resumeFn(message) {
  return message;
}

async function internalMessagesHandler(incoming, meta, notify) {
  const context = buildContext(incoming, meta);
  const {logger, routingKey} = context;
  logger.info(`Got internal-trigger ${JSON.stringify(incoming)} on ${routingKey}`);

  try {
    if (routingKey.endsWith("processed")) {
      logger.info(`Got processed message with key ${routingKey}`);
      const envelope = resumeFn(incoming, context);
      const {message, routingKey: publishToKey} = envelope.attributes;

      await broker.crd.publishMessage(publishToKey, message, meta, context.debugMeta);
      logger.info(`Resumed ${publishToKey} from ${routingKey} with source ${JSON.stringify(message)}`);
    } else {
      const message = triggerFn(incoming, context);
      const {source} = message.attributes;

      await broker.crd.publishMessage(message.id, source, meta, context.debugMeta);
      logger.info(`Triggered ${message.id} from ${routingKey} with source ${JSON.stringify(source)}`);
    }
  } catch (err) {
    return rejectMessage(err, incoming, context, meta, notify);
  }

  return notify.ack();
}

module.exports = internalMessagesHandler;
