"use strict";

const bugsnag = require("bugsnag");
const caller = require("./caller");
const {reject} = require("./broker");
const config = require("exp-config");

async function rejectMessage(queue, error, message, context, meta, notify) {
  const {logger, routingKey} = context;
  const verboseError = buildError(error, caller());
  message.errors = message.errors || [];
  message.errors.push(verboseError);
  logger.error(`Got error: "${error.toString()}" when processing message ${JSON.stringify(message)}`);
  bugsnag.notify(error, verboseError);

  notify.ack();
  const headers = meta.properties.headers || {};
  return await reject.publishMessage(
    routingKey,
    message,
    {
      ...meta.properties,
      headers: {
        ...headers,
        "x-death": [
          {
            count: 1,
            exchange: config.rabbit.exchange,
            queue: queue,
            reason: "rejected",
            "routing-keys": [context.routingKey],
            time: {
              "!": "timestamp",
              value: Math.floor(Date.now() / 1000)
            }
          }
        ],
        "x-first-death-exchange": config.rabbit.exchange,
        "x-first-death-queue": queue,
        "x-first-death-reason": "rejected",
        "x-routing-key": context.routingKey
      }
    },
    context.debugMeta
  );
}

function buildError(error, source) {
  return {
    status: error.code || null,
    source: error.source || source,
    title: error.message
  };
}

module.exports = rejectMessage;
