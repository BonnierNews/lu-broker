"use strict";

const bugsnag = require("bugsnag");
const caller = require("./caller");
const broker = require("./broker");
const config = require("exp-config");
const queueName = `crd-${config.envName}-person`;

async function rejectMessage(error, replyKey, message, context, notify) {
  const {logger} = context;
  const verboseError = buildError(error, caller());
  message.errors = message.errors || [];
  message.errors.push(verboseError);
  logger.error(`Got error: "${error.toString()}" when processing message ${JSON.stringify(message)}`);
  bugsnag.notify(error, verboseError);

  notify.ack();
  return await broker.publishMessage(replyKey, message, {
    type: "REJECT_MESSAGE",
    headers: {
      "x-death": [
        {
          count: 1,
          exchange: config.rabbit.exchange,
          queue: queueName,
          reason: "rejected",
          "routing-keys": [context.routingKey],
          time: {
            "!": "timestamp",
            value: Math.floor(Date.now() / 1000)
          }
        }
      ],
      "x-first-death-exchange": config.rabbit.exchange,
      "x-first-death-queue": queueName,
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
