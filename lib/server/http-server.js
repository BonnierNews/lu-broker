"use strict";
const http = require("http");
const { logger } = require("lu-logger");
const errorHandler = require("./error-handler");
const debugMetaMiddleware = require("./debug-meta-middleware");

function server(routes) {
  return http
    .createServer(async (req, res) => {
      debugMetaMiddleware(req);
      logger.debug("GOT request", req.method, req.url, req.debugMeta);
      const fn = routes[req.url];
      if (fn) {
        try {
          return await fn(req, res);
        } catch (err) {
          return errorHandler(err, req, res);
        }
      } else {
        res.writeHead(404, { "Content-type": "text/plain", "correlation-id": req.correlationId });
        res.write("Not found");
        res.end();
      }
    })
    .listen(3000);
}

module.exports = server;
