"use strict";

const buildContext = require("./context");

function buildRejectHandler() {
  function handleRejectedMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const {logger, routingKey, debugMeta} = context;
    logger.info(`Got rejected message on routing key: ${routingKey}, message: ${JSON.stringify(message)}`, debugMeta);
    return notify.nack(false);
  }

  return handleRejectedMessage;
}

module.exports = buildRejectHandler;
