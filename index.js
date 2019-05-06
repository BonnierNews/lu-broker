"use strict";

const config = require("exp-config");
const uuid = require("uuid");
const broker = require("./lib/broker");
const bugsnag = require("bugsnag");
const retryMessage = require("./lib/retry-message");
const rejectMessage = require("./lib/reject-message");
const recipeRepo = require("./lib/recipe-repo");
const queueName = "hard-coded"; //TODO: fixme
const noOp = () => {};
const buildContext = require("./lib/context");
const {getReplyToKey} = require("./lib/get-routing-key");

let recipeMap;
let mappings;
function start({recipes, lambdas, callback}) {
  recipeMap = recipeRepo.init(recipes);
  mappings = lambdas;
  broker.subscribe(recipeMap.keys(), queueName, handleMessageWrapper, callback || noOp);
}

async function handleMessageWrapper(...args) {
  if (config.bugsnagApiKey) return await bugsnag.autoNotify(() => handleMessage(...args));
  return await handleMessage(...args);
}

async function handleMessage(message, meta, notify) {
  const context = buildContext(message, meta);
  const {logger, routingKey} = context;

  if (isEmptyMessage(message)) {
    logger.error("Received empty message on routing key:", routingKey, "meta:", meta, "message %j", message);
    return notify.ack();
  }

  const handlerFunction = mappings[routingKey];
  if (!handlerFunction) {
    return retryMessage(
      `No handler for routing key: ${routingKey} on queue: ${queueName} message: ${JSON.stringify(message)}`,
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
    replyTo: recipeMap.next(responseKey)
  });
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

module.exports = {start};
