"use strict";

const correlation = require("./correlation");
const {getRoutingKey, getReplyToKey} = require("./get-routing-key");
const {buildLogger} = require("lu-logger");
const httpClient = require("./http-client");
const packageInfo = require("../package.json"); // TODO: make this point to the requirer
const {rejectUnless, rejectIf, retryUnless, retryIf} = require("./reject-helpers");
const events = require("./message-helper");
const {findAttribute, findOrReject} = require("./find-attributes");

function context(message, meta) {
  const retryCount = (meta && meta.properties && meta.properties.headers && meta.properties.headers["x-count"]) || 0;
  const routingKey = getRoutingKey(meta);
  const replyToKey = getReplyToKey(meta);
  const app = packageInfo.name;
  correlation.ensureMessageCorrelation(message);
  const debugMeta = {meta: {...message.meta, routingKey, replyToKey, retryCount, app}};
  const http = httpClient(debugMeta);
  const append = events.append.bind(events.append, message.meta.correlationId);

  return {
    message,
    debugMeta,
    correlationId: message.meta.correlationId,
    routingKey,
    logger: buildLogger(debugMeta),
    http,
    findAttribute,
    findOrReject: findOrReject.bind(findOrReject, rejectUnless),
    rejectUnless,
    rejectIf,
    retryUnless,
    retryIf,
    append
  };
}

module.exports = context;
