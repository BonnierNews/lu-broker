"use strict";
const http = require("http");

function server(routes) {
  return http
    .createServer((req, res) => {
      const fn = routes[req.url];
      if (fn) {
        return fn(req, res);
      } else {
        res.writeHead(404, {"Content-type": "text/plain"});
        res.write("Not found");
        res.end();
      }
    })
    .listen(3000);
}

module.exports = server;
