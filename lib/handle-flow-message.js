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
      `Received message on routing key: ${routingKey}, calling listener ${handlerFunction.name}, message %j`,
      message
    );

    try {
      const responseMessage = await handlerFunction(message, context);
      if (responseMessage) {
        await publish(responseKey, decorateMessage(responseMessage, context), meta, context);
      }
      return notify.ack();
    } catch (err) {
      if (err.rejected) {
        return rejectMessage(err, message, context, meta, notify);
      }
      return retryMessage(err, message, context, notify);
    }
  }

  async function publish(responseKey, message, meta, context) {
    if (!message) return;
    const headers = meta.properties.headers || {};
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

function decorateMessage(message, context) {
  if (!message) return;

  if (message.data) {
    const lastData = message.data[message.data.length - 1];
    if (lastData && !lastData.key) {
      lastData.key = context.routingKey;
    }
  }

  if (message.meta.correlationId !== context.correlationId) {
    context.logger.warning("Correlation in new message %j and orig message %j differs!", message, context.message);
  }
  return message;
}
function isEmptyMessage(message) {
  return !message || (!message.data && !message.attributes && !message.source);
}

module.exports = buildFlowHandler;
