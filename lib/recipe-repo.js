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
    .unique()
    .required()
    .items(joi.string()),
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
    const parts = step.split(".").filter(Boolean);
    if (!step.startsWith(".")) {
      parts.splice(0, 2); // remove namespace, name
    }
    if (parts[0] === "optional") {
      parts.shift(); // remove optional
    }
    if (parts.length !== 2) throw new Error(`Invalid step ${step} in ${recipe.namespace}.${recipe.name}`);
    if (!allowedVerbs.includes(parts[0])) {
      throw new Error(
        `Invalid verb in ${step} in ${recipe.namespace}.${recipe.name}, allowed are ${allowedVerbs.join(", ")}`
      );
    }
  });
}

function validateMaps(recipeMap, lambdaMap) {
  const invalidKey = validateContainsAll(recipeMap, lambdaMap);
  if (invalidKey) {
    throw new Error(`Not all recipe sequence keys exists in lambdas, invalid key: ${invalidKey}`);
  }
  const invalidLambda = validateContainsAll(lambdaMap, recipeMap);
  if (invalidLambda) {
    throw new Error(`Not all lambdas exists in recipe sequence keys, invalid lambda: ${invalidLambda}`);
  }
}
function validateContainsAll(a, b) {
  for (const aVal of Object.keys(a)) {
    if (
      !Object.keys(b).some((bVal) => {
        return bVal === aVal;
      })
    ) {
      return aVal;
    }
  }
}

function init(recipes, lambdas) {
  validate(recipes, recipeShema);
  const recipeMap = {};
  const firstMap = {};
  const lambdaMap = {...lambdas};

  recipes.forEach((recipe) => {
    const prefix = `${recipe.namespace}.${recipe.name}`;
    recipe.sequence.forEach((step, idx) => {
      const next = recipe.sequence[idx + 1] || ".processed";
      recipeMap[`${prefix}${prependPeriod(step)}`] = `${prefix}${prependPeriod(next)}`;
    });

    if (recipe.sequence[0]) {
      firstMap[prefix] = `${prefix}${prependPeriod(recipe.sequence[0])}`;
    }
  });

  recipes.forEach((recipe) => {
    const prefix = `${recipe.namespace}.${recipe.name}`;
    recipe.sequence.forEach((step) => {
      if (!step.startsWith(".")) {
        lambdaMap[`${prefix}.${step}`] = lambdaMap[step];
      }
    });
  });

  validateMaps(recipeMap, lambdaMap);

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
