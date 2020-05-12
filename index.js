"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");

const {crd, reject, lambdasQueueName, triggersQueueName, rejectQueueName, brokerBackend} = require("./lib/broker");
const bugsnag = require("bugsnag");
const recipeRepo = require("./lib/recipe-repo");
const liveness = require("./liveness");
const buildFlowHandler = require("./lib/handle-flow-message");
const buildTriggerHandler = require("./lib/handle-trigger-message");
const buildRejectHandler = require("./lib/handle-rejected-message");
const context = require("./lib/context");
const publishCli = require("./publish-cli");
const shutdownHandler = require("./lib/graceful-shutdown");
let server;

function start({recipes, triggers, useParentCorrelationId}) {
  logger.info(`Using ${brokerBackend} as lu-broker backend`);
  if (!config.disableGracefulShutdown) {
    shutdownHandler.init();
  }
  const recipeMap = recipeRepo.init(recipes, triggers);
  const handleFlowMessage = buildFlowHandler(recipeMap);
  const handleTriggerMessage = buildTriggerHandler(recipeMap, useParentCorrelationId);
  const handleRejectMessage = buildRejectHandler();
  const flowKeys = recipeMap.keys();
  const triggerKeys = recipeMap.triggerKeys();
  crd.subscribe(flowKeys, lambdasQueueName, handleMessageWrapper(handleFlowMessage));
  crd.subscribe(triggerKeys, triggersQueueName, handleMessageWrapper(handleTriggerMessage));
  reject.subscribe([...flowKeys, ...triggerKeys], rejectQueueName, handleMessageWrapper(handleRejectMessage));

  const routes = require("./lib/http-routes")(triggerKeys);
  server = require("./lib/http-server")(routes);
}

function stop() {
  if (!server) return Promise.resolve(server);
  return new Promise((resolve) => server.close(resolve));
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
  stop,
  publishCli,
  testHelpers: brokerBackend === "fake-rabbitmq" ? require("./lib/test-helpers") : null
};
