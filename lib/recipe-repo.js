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
    .regex(/^[a-z][-a-z.]*$/)
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

function init(recipes) {
  validate(recipes, recipeShema);
  const recipeMap = {};
  const firstMap = {};
  const lambdaMap = {};

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
        lambdaMap[`${prefix}${key}`] = fn;
        if (!fn) throw new Error(`Invalid function for key ${prefix}${key}`);
      } else if (fn) {
        lambdaMap[`${prefix}.${key}`] = fn;
      }
    });
  });

  return {
    first: (namespace, name) => firstMap[`${namespace}.${name}`],
    next: (replyKey) => recipeMap[replyKey],
    keys: () => recipes.map((r) => `${r.namespace}.${r.name}.#`),
    triggerKeys: () => recipes.map((r) => `trigger.${r.namespace}.${r.name}`),
    handler: (routingKey) => lambdaMap[routingKey]
  };
}

function prependPeriod(key) {
  if (key.startsWith(".")) return key;
  return `.${key}`;
}

module.exports = {init};
