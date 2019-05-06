"use strict";

const config = require("exp-config");
const broker = require("./lib/broker");
const bugsnag = require("bugsnag");
const recipeRepo = require("./lib/recipe-repo");
const lamdasQueueName = "hard-coded-lambdas"; //TODO: fixme
const triggersQueueName = "hard-coded-triggers"; //TODO: fixme
const noOp = () => {};
const buildFlowHandler = require("./lib/handle-flow-message");
const buildTriggerHandler = require("./lib/handle-trigger-message");

function start({recipes, lambdas, callback}) {
  callback = callback || noOp;
  const recipeMap = recipeRepo.init(recipes, lambdas);
  const handleFlowMessage = buildFlowHandler(recipeMap);
  const handleTriggerMessage = buildTriggerHandler(recipeMap);
  broker.subscribe(recipeMap.keys(), lamdasQueueName, handleMessageWrapper(handleFlowMessage), callback);
  broker.subscribe(recipeMap.triggerKeys(), triggersQueueName, handleMessageWrapper(handleTriggerMessage), callback);
}

function handleMessageWrapper(fn) {
  return (...args) => {
    if (config.bugsnagApiKey) return bugsnag.autoNotify(() => fn(...args));
    return fn(...args);
  };
}

module.exports = {start};
