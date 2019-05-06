"use strict";

const recipeMap = {};

function init(recipes) {
  recipes.forEach((recipe) => {
    recipe.sequence.forEach((step, idx) => {
      const prefix = `${recipe.namespace}.${recipe.name}`;
      const next = recipe.sequence[idx + 1] || ".processed";
      recipeMap[`${prefix}${prependPeriod(step)}`] = `${prefix}${prependPeriod(next)}`;
    });
  });
  return {
    next: (replyKey) => {
      return recipeMap[replyKey];
    },
    keys: () => {
      return [];
    }
  };
}

function prependPeriod(key) {
  if (key.startsWith(".")) return key;
  return `.${key}`;
}

module.exports = {init};
