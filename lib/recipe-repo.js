"use strict";

function init(recipes) {
  const recipeMap = {};
  const firstMap = {};
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
  return {
    first: (namespace, name) => firstMap[`${namespace}.${name}`],
    next: (replyKey) => recipeMap[replyKey],
    keys: () => recipes.map((r) => `${r.namespace}.${r.name}.#`),
    triggerKeys: () => recipes.map((r) => `trigger.${r.namespace}.${r.name}`)
  };
}

function prependPeriod(key) {
  if (key.startsWith(".")) return key;
  return `.${key}`;
}

module.exports = {init};
