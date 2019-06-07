"use strict";

let testHelpers;
const config = require("exp-config");
if (config.envName === "test") {
  const fakeAmqp = require("exp-fake-amqplib");
  const proxyquire = require("proxyquire");
  proxyquire("exp-amqp-connection/bootstrap", {
    "amqplib/callback_api": fakeAmqp
  });
  testHelpers = require("./lib/test-helpers");
}

const {crd, reject, lambdasQueueName, triggersQueueName, rejectQueueName} = require("./lib/broker");
const bugsnag = require("bugsnag");
const recipeRepo = require("./lib/recipe-repo");
const liveness = require("./liveness");
const noOp = () => {};
const buildFlowHandler = require("./lib/handle-flow-message");
const buildTriggerHandler = require("./lib/handle-trigger-message");
const buildRejectHandler = require("./lib/handle-rejected-message");
const context = require("./lib/context");
const publishCli = require("./publish-cli");

function start({recipes, triggers, callback}) {
  callback = callback || noOp;
  const recipeMap = recipeRepo.init(recipes, triggers);
  const handleFlowMessage = buildFlowHandler(recipeMap);
  const handleTriggerMessage = buildTriggerHandler(recipeMap);
  const handleRejectMessage = buildRejectHandler();
  crd.subscribe(recipeMap.keys(), lambdasQueueName, handleMessageWrapper(handleFlowMessage), callback);
  crd.subscribe(recipeMap.triggerKeys(), triggersQueueName, handleMessageWrapper(handleTriggerMessage), callback);
  reject.subscribe(recipeMap.keys(), rejectQueueName, handleMessageWrapper(handleRejectMessage));
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
  testHelpers,
  publishCli
};
