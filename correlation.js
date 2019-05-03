"use strict";

const uuid = require("uuid");

function ensureMessageCorrelation(msg) {
  if (!msg.meta) msg.meta = {};
  if (!msg.meta.correlationId) msg.meta.correlationId = uuid.v4();

  return msg;
}

module.exports = {
  ensureMessageCorrelation
};
