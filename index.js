"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");

const {
  crd,
  reject,
  internal,
  internalPrefix,
  internalQueueName,
  lambdasQueueName,
  triggersQueueName,
  rejectQueueName,
  brokerBackend
} = require("./lib/broker");
const bugsnag = require("bugsnag");
const recipeRepo = require("./lib/recipe-repo");
const liveness = require("./liveness");
const buildFlowHandler = require("./lib/handle-flow-message");
const buildTriggerHandler = require("./lib/handle-trigger-message");
const buildRejectHandler = require("./lib/handle-rejected-message");
const internalMessagesHandler = require("./lib/handle-internal-message");
const context = require("./lib/context");
const publishCli = require("./publish-cli");

function start({recipes, triggers, useParentCorrelationId}) {
  logger.info(`Using ${brokerBackend} as lu-broker backend`);
  if (!config.disableMetricsServer) {
    require("./lib/metrics-server");
  }
  const recipeMap = recipeRepo.init(recipes, triggers);
  const handleFlowMessage = buildFlowHandler(recipeMap);
  const handleTriggerMessage = buildTriggerHandler(recipeMap, useParentCorrelationId);
  const handleRejectMessage = buildRejectHandler();
  crd.subscribe(recipeMap.keys(), lambdasQueueName, handleMessageWrapper(handleFlowMessage));
  crd.subscribe(recipeMap.triggerKeys(), triggersQueueName, handleMessageWrapper(handleTriggerMessage));
  reject.subscribe(recipeMap.keys(), rejectQueueName, handleMessageWrapper(handleRejectMessage));
  internal.subscribe(`${internalPrefix}.#`, internalQueueName, handleMessageWrapper(internalMessagesHandler));
}

function handleMessageWrapper(fn) {
  return (...args) => {
    if (config.bugsnagApiKey) return bugsnag.autoNotify(() => fn(...args));
    return fn(...args);
  };
}

function route(key, fn) {
  const result = {};
  result[key] = fn;
  return result;
}

module.exports = {
  start,
  route,
  liveness,
  buildContext: context,
  publishCli,
  testHelpers: brokerBackend === "fake-rabbitmq" ? require("./lib/test-helpers") : null
};
