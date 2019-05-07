"use strict";

const bugsnag = require("bugsnag");
const caller = require("./caller");
const {reject, lambdasQueueName} = require("./broker");
const config = require("exp-config");

async function rejectMessage(error, message, context, meta, notify) {
  const {logger, routingKey} = context;
  const verboseError = buildError(error, caller());
  message.errors = message.errors || [];
  message.errors.push(verboseError);
  logger.error(`Got error: "${error.toString()}" when processing message ${JSON.stringify(message)}`);
  bugsnag.notify(error, verboseError);

  notify.ack();
  const headers = meta.properties.headers || {};
  return await reject.publishMessage(routingKey, message, {
    ...meta.properties,
    headers: {
      ...headers,
      "x-death": [
        {
          count: 1,
          exchange: config.rabbit.exchange,
          queue: lambdasQueueName,
          reason: "rejected",
          "routing-keys": [context.routingKey],
          time: {
            "!": "timestamp",
            value: Math.floor(Date.now() / 1000)
          }
        }
      ],
      "x-first-death-exchange": config.rabbit.exchange,
      "x-first-death-queue": lambdasQueueName,
      "x-first-death-reason": "rejected",
      "x-routing-key": context.routingKey
    }
  });
}

function buildError(error) {
  return {
    status: error.code,
    source: error.source,
    title: error.message
  };
}

module.exports = rejectMessage;
