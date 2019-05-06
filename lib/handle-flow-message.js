"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const retryMessage = require("./retry-message");
const rejectMessage = require("./reject-message");
const buildContext = require("./context");
const {getReplyToKey} = require("./get-routing-key");

function getHandlerFunction(mappings, routingKey) {
  const [, , ...key] = routingKey.split(".");
  return mappings[routingKey] || mappings[key.join(".")]; // todo use recipts instead
}

function buildFlowHandler(mappings, recipes) {
  async function handleFlowMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const {logger, routingKey} = context;

    if (isEmptyMessage(message)) {
      logger.error("Received empty message on routing key:", routingKey, "meta:", meta, "message %j", message);
      return notify.ack();
    }

    const handlerFunction = getHandlerFunction(mappings, routingKey);
    if (!handlerFunction) {
      return rejectMessage(
        `No handler for routing key: ${routingKey}, message: ${JSON.stringify(message)}`,
        getReplyToKey(meta),
        message,
        context,
        notify
      );
    }

    try {
      logger.info(
        `Received message on routing key: ${routingKey}, calling listener ${handlerFunction.name}, message %j`,
        message
      );
      const responseMessage = await handlerFunction(message, context);
      if (responseMessage) {
        const responseKey = getReplyToKey(meta);
        if (!responseKey) {
          logger.info("Message processed, acking");
        } else {
          await publish(responseKey, decorateMessage(message, context), meta, context);
        }
      }
      return notify.ack();
    } catch (err) {
      if (err.rejected) {
        const responseKey = getReplyToKey(meta);
        return rejectMessage(err, responseKey, message, context, notify);
      }
      return retryMessage(err, message, context, notify);
    }
  }

  async function publish(responseKey, message, meta, context) {
    if (!message) return;
    return await broker.publishMessage(responseKey, message, {
      messageId: uuid.v4(),
      correlationId: context.correlationId,
      headers: meta.properties.headers,
      replyTo: recipes.next(responseKey)
    });
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
