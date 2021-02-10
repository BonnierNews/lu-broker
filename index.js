"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");

const {
  crd,
  reject,
  internal,
  wq,
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
const buildWorkerHandler = require("./lib/handle-worker-message");
const buildRejectHandler = require("./lib/handle-rejected-message");
const buildInternalHandler = require("./lib/handle-internal-message");
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
  const handleInteralMessage = buildInternalHandler(recipeMap);
  const flowKeys = recipeMap.keys();
  const triggerKeys = recipeMap.triggerKeys();

  for (const {key, queue} of recipeMap.workerQueues()) {
    wq.subscribe(key, queue, handleMessageWrapper(buildWorkerHandler(queue, recipeMap)));
  }

  crd.subscribe(flowKeys, lambdasQueueName, handleMessageWrapper(handleFlowMessage));
  crd.subscribe(triggerKeys, triggersQueueName, handleMessageWrapper(handleTriggerMessage));
  reject.subscribe([...flowKeys, ...triggerKeys], rejectQueueName, handleMessageWrapper(handleRejectMessage));

  internal.subscribe(
    [...recipeMap.processedKeys(), ...recipeMap.processedUnrecoverableKeys()],
    internalQueueName,
    handleMessageWrapper(handleInteralMessage)
  );

  const routes = require("./lib/server/routes")(triggerKeys);
  server = require("./lib/server/http-server")(routes);
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
