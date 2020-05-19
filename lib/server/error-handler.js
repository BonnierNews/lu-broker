"use strict";
const {logger} = require("lu-logger");
const config = require("exp-config");
const util = require("util");

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

  res.writeHead(500, {"Content-type": "application/json", "correlation-id": correlationId});
  res.write(JSON.stringify({errors, meta: req.debugMeta}));
  res.end();
}

module.exports = errorHandler;
