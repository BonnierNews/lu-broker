"use strict";

const config = require("exp-config");
const {jobStorage} = config;
function resolveStorage() {
  if (jobStorage === "http") {
    return require("./http-job-storage");
  } else if (jobStorage === "memory") {
    return require("./memory-job-storage");
  } else if (jobStorage === "redis") {
    return require("./redis/redis-job-storage");
  }

  return;
}

module.exports = resolveStorage();
