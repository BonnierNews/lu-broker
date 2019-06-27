"use strict";

const client = require("prom-client");
const http = require("http");
client.collectDefaultMetrics();
module.exports = http
  .createServer((req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, {"Content-Type": client.register.contentType});
      res.write(`${client.register.metrics()}\n`);
      res.end();
    } else {
      res.writeHead(404, {"Content-type": "text/plan"});
      res.write("Not found");
      res.end();
    }
  })
  .listen(3000);
