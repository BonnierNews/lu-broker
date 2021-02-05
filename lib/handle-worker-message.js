"use strict";

const activeHandlers = require("./active-handlers");
const rejectMessage = require("./reject-message");
const buildContext = require("./context");
const {getReplyToKey} = require("./get-routing-key");
const broker = require("./broker");

function buildWorkerHandler(queue) {
  return async function handleWorkerMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const responseKey = getReplyToKey(meta);
    console.log("***** DEBUG ****", meta, __filename);
    try {
      activeHandlers.inc();
      // insert delay
      await broker.crd.publishMessage(responseKey, message, meta, context);
      notify.ack();
    } catch (err) {
      return rejectMessage(queue, err, message, context, meta, notify);
    } finally {
      activeHandlers.dec();
    }
  };
}

module.exports = buildWorkerHandler;
