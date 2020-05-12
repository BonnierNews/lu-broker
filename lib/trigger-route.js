"use strict";
const {crd} = require("./broker");
function triggerHandler(key) {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404, {"Content-type": "application/json"});
      res.write("");
      res.end();

      return;
    }
    const source = await parseBody(req);
    const {correlationId} = req;
    res.writeHead(200, {"Content-Type": "application/json", "x-correlation-id": correlationId});
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
        const body = JSON.parse(chunks.join(""));
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

module.exports = triggerHandler;
