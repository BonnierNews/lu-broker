"use strict";

const correlation = require("./correlation");
const {getRoutingKey, getReplyToKey} = require("./get-routing-key");
const {buildLogger} = require("lu-logger");
//const httpClient = require("./http-client");
//const {assertedFetch} = require("./listeners/helpers/fetch");
const packageInfo = require("../package.json");
const {dieUnless, dieIf} = require("./die-unless");

function context(message, meta) {
  const retryCount = (meta && meta.properties && meta.properties.headers && meta.properties.headers["x-count"]) || 0;
  const routingKey = getRoutingKey(meta);
  const replyToKey = getReplyToKey(meta);
  const app = packageInfo.name;
  correlation.ensureMessageCorrelation(message);
  const debugMeta = {meta: {...message.meta, routingKey, replyToKey, retryCount, app}};
  //const http = httpClient(debugMeta);

  return {
    message,
    debugMeta,
    correlationId: message.meta.correlationId,
    routingKey,
    logger: buildLogger(debugMeta),
    //http,
    //assertedFetch: assertedFetch.bind(assertedFetch, http),
    dieUnless,
    dieIf
  };
}

module.exports = context;
