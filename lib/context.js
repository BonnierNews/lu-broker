"use strict";

const correlation = require("./correlation");
const {getRoutingKey, getReplyToKey} = require("./get-routing-key");
const {buildLogger} = require("lu-logger");
const httpClient = require("./http-client");
const packageInfo = require(`${process.cwd()}/package.json`);
const {
  rejectUnless,
  rejectIf,
  retryUnless,
  retryIf,
  unrecoverableIf,
  unrecoverableUnless,
  caseIf,
  caseUnless
} = require("./reject-helpers");
const {findAttribute, findOrReject} = require("./find-attributes");

function context(message, meta, isTrigger) {
  const retryCount = (meta && meta.properties && meta.properties.headers && meta.properties.headers["x-count"]) || 0;
  const routingKey = getRoutingKey(meta);
  const replyToKey = getReplyToKey(meta);
  const app = packageInfo.name;
  correlation.ensureMessageCorrelation(message, meta);
  const debugMeta = {meta: {...message.meta, routingKey, replyToKey, retryCount, app}};
  const http = httpClient(debugMeta);
  const logger = buildLogger(debugMeta);

  if (
    !isTrigger &&
    meta &&
    meta.properties &&
    meta.properties.correlationId &&
    meta.properties.correlationId !== message.meta.correlationId
  ) {
    logger.info(
      `Changed from message correlationId (${message.meta.correlationId}) to AMQP property correlationId (${meta.properties.correlationId})`
    );
  }
  return {
    message,
    debugMeta,
    correlationId: (meta && meta.properties && meta.properties.correlationId) || message.meta.correlationId,
    routingKey,
    logger,
    http,
    findAttribute,
    findOrReject: findOrReject.bind(findOrReject, rejectUnless),
    rejectUnless,
    rejectIf,
    retryCount,
    retryUnless,
    retryIf,
    unrecoverableIf,
    unrecoverableUnless,
    caseIf,
    caseUnless
  };
}

module.exports = context;
