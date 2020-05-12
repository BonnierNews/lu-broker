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
        const body = JSON.parse(Buffer.concat(chunks).toString());
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

module.exports = triggerHandler;
