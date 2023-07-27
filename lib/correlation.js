"use strict";

const uuid = require("uuid");

function ensureMessageCorrelation(msg, meta) {
  if (!msg.meta) msg.meta = {};
  if (!msg.meta.correlationId) {
    msg.meta.correlationId = (meta && meta.properties && meta.properties.correlationId) || uuid.v4();
  }

  return msg;
}

module.exports = { ensureMessageCorrelation };
