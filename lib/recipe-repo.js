"use strict";

const joi = require("joi");

const allowedVerbs = ["get-or-create", "get", "update", "upsert", "delete", "validate", "perform"];

const sequenceSchema = joi.object().keys({
  namespace: joi
    .string()
    .only(["event", "action"])
    .required(),
  name: joi
    .string()
    .regex(/^[a-z0-9][-a-z0-9.]*$/)
    .required(),
  sequence: joi
    .array()
    .unique((a, b) => Object.keys(a)[0] === Object.keys(b)[0])
    .required()
    .items(joi.object().length(1)),
  catchers: joi.array()
});

const recipeShema = joi
  .array()
  .unique((a, b) => a.name === b.name && a.namespace === b.namespace)
  .items(sequenceSchema);

function validate(recipes) {
  const {error} = joi.validate(recipes, recipeShema);
  if (error) {
    const message = error.details.map((d) => `value: ${JSON.stringify(d.context.value)} detail: ${d.message}`);
    error.message = message.join(", ");
    throw error;
  }
  recipes.forEach(validateSequenceFormat);
}

function validateSequenceFormat(recipe) {
  recipe.sequence.forEach((step) => {
    const [key] = Object.keys(step);
    const parts = key.split(".").filter(Boolean);
    if (!key.startsWith(".")) {
      parts.splice(0, 2); // remove namespace, name
    }
    if (parts[0] === "optional") {
      parts.shift(); // remove optional
    }
    if (parts.length !== 2) throw new Error(`Invalid step ${key} in ${recipe.namespace}.${recipe.name}`);
    if (!allowedVerbs.includes(parts[0])) {
      throw new Error(
        `Invalid verb in ${key} in ${recipe.namespace}.${recipe.name}, allowed are ${allowedVerbs.join(", ")}`
      );
    }
  });
}

function validateBorrowsExists(lambdaMap, borrowedKeys) {
  Object.entries(borrowedKeys).forEach(([borrowed, key]) => {
    if (!lambdaMap[key]) {
      const causingEvent = borrowed
        .split(".")
        .slice(0, 2)
        .join(".");
      const given = key
        .split(".")
        .slice(0, 2)
        .join(".");
      throw new Error(`Error in '${causingEvent}': borrowed key '${key}' does not exist in '${given}'`);
    }
  });
}

function init(recipes) {
  validate(recipes, recipeShema);
  const recipeMap = {};
  const firstMap = {};
  const lambdaMap = {};
  const borrowedKeys = {};

  recipes.forEach((recipe) => {
    const prefix = `${recipe.namespace}.${recipe.name}`;
    recipe.sequence.forEach((step, idx) => {
      const [key] = Object.keys(step);
      const [next] = recipe.sequence[idx + 1] ? Object.keys(recipe.sequence[idx + 1]) : [".processed"];
      recipeMap[`${prefix}${prependPeriod(key)}`] = `${prefix}${prependPeriod(next)}`;
    });

    if (recipe.sequence[0]) {
      const [key] = Object.keys(recipe.sequence[0]);
      firstMap[prefix] = `${prefix}${prependPeriod(key)}`;
    }
  });

  recipes.forEach((recipe) => {
    const prefix = `${recipe.namespace}.${recipe.name}`;
    recipe.sequence.forEach((step) => {
      const [key, fn] = Object.entries(step)[0];
      if (key.startsWith(".")) {
        if (!fn) throw new Error(`No function given for key '${key}' in '${prefix}'`);
        if (typeof fn !== "function") {
          throw new Error(`Only functions are supported as handlers (key '${key}' in '${prefix}')`);
        }
        lambdaMap[`${prefix}${key}`] = fn;
      } else {
        if (fn) throw new Error(`Handler function not allowed for borrowed key: '${key}' in '${prefix}'`);
        borrowedKeys[`${prefix}.${key}`] = key;
      }
    });
  });

  validateBorrowsExists(lambdaMap, borrowedKeys);

  return {
    first: (namespace, name) => firstMap[`${namespace}.${name}`],
    next: (replyKey) => recipeMap[replyKey],
    keys: () => recipes.map((r) => `${r.namespace}.${r.name}.#`),
    triggerKeys: () => recipes.map((r) => `trigger.${r.namespace}.${r.name}`),
    handler: (routingKey) => {
      return lambdaMap[routingKey] || (borrowedKeys[routingKey] && lambdaMap[borrowedKeys[routingKey]]);
    }
  };
}

function prependPeriod(key) {
  if (key.startsWith(".")) return key;
  return `.${key}`;
}

module.exports = {init};
