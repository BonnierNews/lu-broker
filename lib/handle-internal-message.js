"use strict";

const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");

async function triggerFn(message, context) {
  const {http, retryUnless} = context;
  const {source} = message.attributes;
  source.meta = {
    ...source.meta,
    correlationId: `${context.correlationId}:0`, // todo: generate child guid?
    parentCorrelationId: context.correlationId,
    notifyProcessed: message.id
  };

  const response = await http.post({
    path: "/entity/v2/broker-job",
    body: {
      id: message.id,
      message: message.attributes.message,
      responseKey: message.attributes.responseKey
    }
  });
  retryUnless([200, 201, 409].includes(response.statusCode));
  return message;
}

async function resumeFn(message, context) {
  const {http, retryUnless} = context;
  const {notifyProcessed} = message.meta;

  const response = await http.put({
    path: `/entity/v2/broker-job/${notifyProcessed}`
  });
  retryUnless([200, 201].includes(response.statusCode));
  return response.body;
}

async function internalMessagesHandler(incoming, meta, notify) {
  const context = buildContext(incoming, meta);
  const {logger, routingKey} = context;
  logger.info(`Got internal-trigger ${JSON.stringify(incoming)} on ${routingKey}`);

  try {
    if (routingKey.endsWith(".processed")) {
      if (!incoming.meta.notifyProcessed) return notify.ack();
      logger.info(`Got processed message with key ${routingKey}`);
      const envelope = await resumeFn(incoming, context);
      const {message, responseKey} = envelope.attributes;

      await broker.crd.publishMessage(responseKey, message, meta, context.debugMeta);
      logger.info(`Resumed ${responseKey} from ${routingKey} with source ${JSON.stringify(message)}`);
    } else {
      const message = await triggerFn(incoming, context);
      const {source, trigger} = message.attributes;

      await broker.crd.publishMessage(trigger, source, meta, context.debugMeta);
      logger.info(`Triggered ${message.id} from ${routingKey} with source ${JSON.stringify(source)}`);
    }
  } catch (err) {
    return rejectMessage(err, incoming, context, meta, notify);
  }

  return notify.ack();
}

module.exports = internalMessagesHandler;
