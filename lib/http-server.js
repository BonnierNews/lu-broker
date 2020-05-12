"use strict";
const http = require("http");
const {logger} = require("lu-logger");
const uuid = require("uuid");
const camelcase = require("camelcase");
const debugPrefix = "x-debug-meta";
const config = require("exp-config");
const util = require("util");

function server(routes) {
  return http
    .createServer(async (req, res) => {
      debugMeta(req);
      logger.debug("GOT request", req.method, req.url, req.debugMeta);
      const fn = routes[req.url];
      if (fn) {
        try {
          return await fn(req, res);
        } catch (err) {
          return errorHandler(err, req, res);
        }
      } else {
        res.writeHead(404, {"Content-type": "text/plain"});
        res.write("Not found");
        res.end();
      }
    })
    .listen(3000);
}

function debugMeta(req) {
  let correlationId =
    req.headers["correlation-id"] || req.headers["x-correlation-id"] || req.headers[`${debugPrefix}-correlation-id`];
  if (!correlationId) {
    correlationId = uuid.v4();
  }
  req.correlationId = correlationId;
  const meta = {correlationId};
  for (const header of Object.keys(req.headers)) {
    if (header.startsWith(debugPrefix) && header !== `${debugPrefix}-correlation-id`) {
      meta[debugKey(header)] = req.headers[header];
    }
  }
  req.debugMeta = meta;
}

const prefixRegExp = new RegExp(`^${debugPrefix}-`);
function debugKey(header) {
  return camelcase(header.replace(prefixRegExp, ""));
}

function errorHandler(err, req, res) {
  const {correlationId} = req;
  if (!err) return;
  let errorMessage = err instanceof Error ? err.toString() : JSON.stringify(err);
  logger.error(util.format("Error received in errorHandler:", err, correlationId, req.originalUrl), req.debugMeta);

  if (config.envName === "production") {
    errorMessage = `Internal error! Request id: ${correlationId}`;
  }

  const errors = [
    {
      status: "500",
      title: "Server Error",
      source: `${req.url}`,
      detail: `${req.method} ${req.url}: ${errorMessage}`
    }
  ];

  res.writeHead(500, {"Content-type": "application/json"});
  res.write(JSON.stringify({errors, meta: req.debugMeta}));
  res.end();
}

module.exports = server;
