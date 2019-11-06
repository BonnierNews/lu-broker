"use strict";

const {getMetrics} = require("./metrics");

const http = require("http");
module.exports = http
  .createServer((req, res) => {
    const {metrics, contentType} = getMetrics();
    if (req.url === "/metrics") {
      res.writeHead(200, {"Content-Type": contentType});
      res.write(`${metrics}\n`);
      res.end();
    } else {
      res.writeHead(404, {"Content-type": "text/plan"});
      res.write("Not found");
      res.end();
    }
  })
  .listen(3000);
