"use strict";

const activeHandlers = require("./active-handlers");
const rejectMessage = require("./reject-message");
const buildContext = require("./context");
const { getReplyToKey } = require("./get-routing-key");
const broker = require("./broker");

function buildWorkerHandler(queue, recipeMap) {
  return async function handleWorkerMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const responseKey = getReplyToKey(meta);
    const headers = meta.properties.headers || {};
    delete headers["x-routing-key"];

    try {
      activeHandlers.inc();
      await sleep(recipeMap.executionDelay(responseKey) || 100);
      await broker.crd.publishMessage(
        responseKey,
        message,
        {
          correlationId: context.correlationId,
          headers,
        },
        context
      );
      notify.ack();
    } catch (err) {
      return rejectMessage(queue, err, message, context, meta, notify);
    } finally {
      activeHandlers.dec();
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = buildWorkerHandler;
