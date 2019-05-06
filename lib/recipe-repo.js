"use strict";

function init(recipes) {
  const recipeMap = {};
  const keys = [];
  recipes.forEach((recipe) => {
    const prefix = `${recipe.namespace}.${recipe.name}`;

    keys.push(`${prefix}.#`);
    recipe.sequence.forEach((step, idx) => {
      const next = recipe.sequence[idx + 1] || ".processed";
      recipeMap[`${prefix}${prependPeriod(step)}`] = `${prefix}${prependPeriod(next)}`;
    });
  });
  return {
    next: (replyKey) => recipeMap[replyKey],
    keys: () => keys
  };
}

function prependPeriod(key) {
  if (key.startsWith(".")) return key;
  return `.${key}`;
}

module.exports = {init};
