"use strict";

const config = require("exp-config");
const {jobStorage} = config;
const httpJobStorage = require("./http-job-storage");
const inMemoryStorage = require("./memory-job-storage");

function resolveStorage() {
  if (jobStorage === "http") {
    return httpJobStorage;
  } else if (jobStorage === "memory") {
    return inMemoryStorage;
  }

  return {
    storeParent: () => {},
    storeChild: () => {},
    reset: () => {}
  };
}

module.exports = resolveStorage();
