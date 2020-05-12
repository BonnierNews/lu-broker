"use strict";

const config = require("exp-config");
const {getMetrics} = require("./metrics");
const {logger} = require("lu-logger");

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
    triggerKeys
      .map((key) => key.replace("event.", "").replace(".", "/"))
      .forEach((key) => {
        routes[`/${key}`] = (req, res) => {
          res.writeHead(200, {"Content-Type": "application/json"});
          res.write(``);
          res.end();
        };
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
