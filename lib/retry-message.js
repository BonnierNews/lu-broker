"use strict";
const config = require("exp-config");

function retryMessage(error, message, context, notify) {
  const {logger} = context;
  const verboseError = buildError(error);
  message.errors = message.errors || [];
  message.errors.push(verboseError);
  logger.error(`Got error: "${error.toString()}" when processing message ${JSON.stringify(message)}`);

  notify.nack(false);
  if (config.envName === "test" && !config.boolean("silenceTestErrors")) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function buildError(error) {
  return {
    status: error.code,
    source: error.source,
    title: error.message
  };
}

module.exports = retryMessage;
