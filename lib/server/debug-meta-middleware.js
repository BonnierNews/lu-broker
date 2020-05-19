"use strict";
const uuid = require("uuid");
const camelcase = require("camelcase");
const debugPrefix = "x-debug-meta";

function debugMetaMiddleware(req) {
  let correlationId =
    req.headers["correlation-id"] || req.headers["x-correlation-id"] || req.headers[`${debugPrefix}-correlation-id`];
  if (!correlationId) {
    correlationId = uuid.v4();
  }
  req.correlationId = correlationId;
  const meta = {correlationId};
  for (const header of Object.keys(req.headers)) {
    if (header.startsWith(debugPrefix) && header !== `${debugPrefix}-correlation-id`) {
      meta[debugKey(header)] = req.headers[header];
    }
  }
  req.debugMeta = meta;
}

const prefixRegExp = new RegExp(`^${debugPrefix}-`);
function debugKey(header) {
  return camelcase(header.replace(prefixRegExp, ""));
}

module.exports = debugMetaMiddleware;
