"use strict";

let recipeMap;

function init(recipes) {
  recipeMap = recipes;
  return {
    //TODO: tänkte att man kan använda first för trriggers
    first: (namespace, name) => {
      const recipe = recipeFromName(namespace, name);
      const routingKey = computeRoutingKey(recipe, 0);
      const replyTo = nextRoutingKey(routingKey);
      return {routingKey, replyTo}; //TODO: remove replyto... only next key is needed
    },
    next: (routingKey) => {
      const nextRk = nextRoutingKey(routingKey);
      const replyTo = nextRoutingKey(nextRk);
      return {routingKey: nextRk, replyTo}; //TODO: remove replyto... only next key is needed
    }
  };
}

function nextRoutingKey(routingKey) {
  if (!routingKey) return "";
  const name = extractName(routingKey);
  const namespace = extractNamespace(routingKey);
  const key = extractKey(routingKey);
  const recipe = recipeFromName(namespace, name);
  if (isProcessed(recipe, routingKey)) return "";
  const keyIdx = recipe.sequence.findIndex((k) => k === `.${key}`);
  return computeRoutingKey(recipe, keyIdx + 1);
}

function recipeFromName(namespace, name) {
  return recipeMap.find((r) => r.namespace === namespace && r.name === name);
}

function extractName(routingKey) {
  return routingKey.split(".")[1];
}
function extractNamespace(routingKey) {
  return routingKey.split(".")[0];
}

function extractKey(routingKey) {
  return routingKey.split(".")[2];
}

function computeRoutingKey(recipe, idx) {
  return `${recipe.namespace}.${recipe.name}${recipe.sequence[idx] || ".processed"}`;
}

function isProcessed(recipe, routingKey) {
  return routingKey === `${recipe.namespace}.${recipe.name}.processed`;
}

module.exports = {init};
