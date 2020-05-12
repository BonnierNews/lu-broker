"use strict";
const {crd} = require("./broker");
function triggerHandler(key) {
  return async (req, res) => {
    const {correlationId} = req;
    if (req.method !== "POST") {
      res.writeHead(404, {"Content-type": "application/json", "correlation-id": correlationId});
      res.write("");
      res.end();

      return;
    }
    const source = await parseBody(req);
    const errors = validate(source);
    if (errors.length > 0) {
      return renderError(errors, res, req);
    }

    res.writeHead(200, {"Content-Type": "application/json", "correlation-id": correlationId});
    await crd.publishMessage(key, source, {meta: {correlationId}});
    res.write(JSON.stringify({meta: {correlationId}}));
    res.end();
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function renderError(errors, res, req) {
  const {correlationId} = req;
  res.writeHead(400, {"Content-Type": "application/json", "correlation-id": correlationId});
  res.write(JSON.stringify({errors: errors.map(buildError), meta: {correlationId}}));
  res.end();
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

function buildError(detail) {
  return {
    title: `ValidationError in body`,
    status: "validation_error",
    source: {pointer: `body[${detail.path}]`},
    detail: detail.message
  };
}
module.exports = triggerHandler;
