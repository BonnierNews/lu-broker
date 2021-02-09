"use strict";
const {crd} = require("./queue-helper");

function setupWaiter(key) {
  return new Promise((resolve) => crd.subscribe(key, resolve));
}

module.exports = {setupWaiter};
