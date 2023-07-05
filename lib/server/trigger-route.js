"use strict";
const {crd} = require("../broker");
const parseBody = require("./parse-body");
const {logger} = require("lu-logger");

function triggerHandler(key) {
  logger.info("in triggerHandler");
  return async (req, res) => {
    const {correlationId} = req;
    if (req.method !== "POST") {
      logger.info("req.method !== POST", req.method);
      res.writeHead(404, {"Content-type": "application/json", "correlation-id": correlationId});
      res.write("");
      res.end();

      return;
    }
    const source = await parseBody(req);
    const errors = validate(source);
    if (errors.length > 0) {
      logger.info("errors.length > 0", errors);
      return renderError(errors, res, req);
    }

    res.writeHead(200, {"Content-Type": "application/json", "correlation-id": correlationId});
    await crd.publishMessage(key, source, {correlationId});
    res.write(JSON.stringify({meta: {correlationId}}));
    res.end();
  };
}
function validate(source) {
  const errors = [];
  for (const field of ["type", "id", "attributes"]) {
    if (!source[field]) {
      errors.push({
        path: field,
        message: `Missing required attribute '${field}'`
      });
    }
  }

  return errors;
}

function renderError(errors, res, req) {
  const {correlationId} = req;
  res.writeHead(400, {"Content-Type": "application/json", "correlation-id": correlationId});
  res.write(JSON.stringify({errors: errors.map(buildError), meta: {correlationId}}));
  res.end();
}

function buildError(detail) {
  return {
    title: `ValidationError in body`,
    status: "validation_error",
    source: {pointer: `body[${detail.path}]`},
    detail: detail.message
  };
}
module.exports = triggerHandler;
