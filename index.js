"use strict";

const config = require("exp-config");
const bugsnag = require("bugsnag");
const util = require("util");
const {logger} = require("lu-logger");

const queueName = "hard-coded";
const broker = require("./broker");

let mappings;
async function start({recipes, lambdas}) {
  mappings = lambdas;
  return await util.promisify(broker.subscribe)(Object.keys(lambdas), queueName, handleMessageWrapper);
}

async function handleMessageWrapper(...args) {
  if (config.bugsnagApiKey) return await bugsnag.autoNotify(() => handleMessage(...args));
  return await handleMessage(...args);
}

async function handleMessage(message, meta, notify) {
  const routingKey = getRoutingKey(meta);
  // const context = buildContext(message, meta);
  // const {logger, routingKey} = context;

  // if (isEmptyMessage(message)) {
  //   logger.error("Received empty message on routing key:", routingKey, "meta:", meta, "message %j", message);
  //   return notify.ack();
  // }

  const handlerFunction = mappings[routingKey];
  // if (!handlerFunction) {
  //   return retryMessage(
  //     `No handler for routing key: ${routingKey} on queue: ${queueName} message: ${JSON.stringify(message)}`,
  //     message,
  //     context,
  //     notify
  //   );
  // }

  try {
    logger.info(
      `Received message on routing key: ${routingKey}, calling listener ${handlerFunction.name}, message %j`,
      message
    );
    const responseMessage = await handlerFunction(message);
    if (responseMessage) {
      await publish(getResponseKey(message, meta, routingKey), message);
    }
    return notify.ack();
  } catch (err) {
    throw err;
    //   if (toggle("die4Real") && err.rejected) {
    //     const responseKey = getResponseKey(message, meta, context.routingKey);
    //     return rejectMessage(err, responseKey, message, context, notify);
    //   }
    //   return retryMessage(err, message, context, notify);
  }
}

function publish(responseKey, message, context) {
  return new Promise((resolve, reject) => {
    if (!message) return resolve();
    // decorateMessage(message, context);
    return broker.publish(responseKey, message, (err) => {
      if (err) return reject(err);
      context.logger.debug("Published message on routing key: %s message: %j", responseKey, message);
      return resolve();
    });
  });
}

function getResponseKey(msg, meta, routingKey) {
  if (routingKey.endsWith(".unrecoverable")) return `${routingKey}.processed`;
  if (msg.error) return `${routingKey}.unrecoverable`;
  return meta.properties.replyTo;
}

function getRoutingKey(meta) {
  if (!meta || !meta.properties || !meta.fields) return;
  return (meta.properties.headers && meta.properties.headers["x-routing-key"]) || meta.fields.routingKey;
}

module.exports = {start};
