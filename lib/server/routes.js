"use strict";

const config = require("exp-config");
const {getMetrics} = require("../metrics");
const {logger} = require("lu-logger");
const triggerHandler = require("./trigger-route");

function routesFn(triggerKeys = []) {
  const routes = {};

  if (!config.disableMetricsServer) {
    routes["/metrics"] = (req, res) => {
      const {metrics, contentType} = getMetrics();
      res.writeHead(200, {"Content-Type": contentType});
      res.write(`${metrics}\n`);
      res.end();
    };
  }

  if (!config.disableTriggerServer) {
    triggerKeys.forEach((key) => {
      const urlKey = key.replace("event.", "").replace(".", "/");
      routes[`/${urlKey}`] = triggerHandler(key);
    });
  }

  routes[`/_debug`] = (req, res) => {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write(`${Object.keys(routes)}`);
    res.end();
  };
  logger.debug("Routes are", Object.keys(routes));

  return routes;
}

module.exports = routesFn;
