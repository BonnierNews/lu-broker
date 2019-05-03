"use strict";

const http = require("http");
const port = 3000;
const packageInfo = require("./package.json");
const {logger} = require("lu-logger");

const requestHandler = (request, response) => {
  response.writeHead(200, {"Content-type": "application/json"});
  response.end(
    JSON.stringify({
      namespace: "event",
      uri: "/",
      name: "order-v2",
      sequence: [".validate", ".append.upsales__order"]
    })
  );
};

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) throw err;
  logger.info(`${packageInfo.name} listening on port ${server.address().port}`);
});
