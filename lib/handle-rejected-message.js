"use strict";

const buildContext = require("./context");

function buildRejectHandler() {
  function handleRejectedMessage(message, meta, notify) {
    const context = buildContext(message, meta);
    const {logger, routingKey, debugMeta} = context;
    logger.warning(
      `Got rejected message on routing key: ${routingKey}, message: ${JSON.stringify(
        message
      )}, rabbitMeta: ${JSON.stringify({fields: meta.fields, properties: meta.properties})}`,
      debugMeta
    );
    return notify.nack(false);
  }

  return handleRejectedMessage;
}

module.exports = buildRejectHandler;
