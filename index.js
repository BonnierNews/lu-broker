"use strict";

const config = require("exp-config");
const {crd, reject, lambdasQueueName, triggersQueueName, rejectQueueName} = require("./lib/broker");
const bugsnag = require("bugsnag");
const recipeRepo = require("./lib/recipe-repo");
const noOp = () => {};
const buildFlowHandler = require("./lib/handle-flow-message");
const buildTriggerHandler = require("./lib/handle-trigger-message");
const buildRejectHandler = require("./lib/handle-rejected-message");
const context = require("./lib/context");

function start({recipes, lambdas, callback}) {
  callback = callback || noOp;
  const recipeMap = recipeRepo.init(recipes, lambdas);
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

module.exports = {
  start,
  buildContext: context
};
