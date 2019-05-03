"use strict";

let recipeMap;

function init(recipes) {
  recipeMap = recipes;
  return {
    //TODO: tänkte att man kan använda first för trriggers
    first: (namespace, name) => {
      const recipe = recipeFromName(namespace, name);
      const routingKey = computeRoutingKey(recipe, 0);
      const replyTo = nextRoutingKey(namespace, name, routingKey);
      return {routingKey, replyTo}; //TODO: remove replyto... only next key is needed
    },
    next: (namespace, name, routingKey) => {
      const nextRk = nextRoutingKey(namespace, name, routingKey);
      const replyTo = nextRoutingKey(namespace, name, nextRk);
      return {routingKey: nextRk, replyTo}; //TODO: remove replyto... only next key is needed
    }
  };
}

function nextRoutingKey(namespace, name, routingKey) {
  if (!routingKey) return;

  const key = calculateKey(namespace, name, routingKey);
  const recipe = recipeFromName(namespace, name);
  if (isProcessed(recipe, routingKey)) return;
  const keyIdx = recipe.sequence.findIndex((k) => k === key);
  return computeRoutingKey(recipe, keyIdx + 1);
}

function calculateKey(namespace, name, routingKey) {
  const [keyNamespace, keyName, key] = routingKey.split(".");
  if (keyNamespace === namespace && keyName === name) {
    return `.${key}`;
  }
  return routingKey;
}

function recipeFromName(namespace, name) {
  return recipeMap.find((r) => r.namespace === namespace && r.name === name);
}

function computeRoutingKey(recipe, idx) {
  const key = recipe.sequence[idx] || ".processed";
  if (key.startsWith(".")) {
    return `${recipe.namespace}.${recipe.name}${key}`;
  }
  return key;
}

function isProcessed(recipe, routingKey) {
  return routingKey === `${recipe.namespace}.${recipe.name}.processed`;
}

module.exports = {init};
