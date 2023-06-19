"use strict";

const config = require("exp-config");

const request = require("request");

function rabbitStatus() {
  return new Promise((resolve, reject) => {
    request.get(`${config.rabbit.apiUrl}/api/connections`, (err, response, body) => {
      if (err) return reject(err);
      if (response.statusCode !== 200) return reject(new Error(response.statusCode));
      const myConn = JSON.parse(body).find((conn) => conn.client_properties.connection_name === config.HOSTNAME);
      if (!myConn) return reject(new Error(`Could not find rabbit connection for: ${config.HOSTNAME}`));
      resolve();
    });
  })
    .then(() => 0)
    .catch(() => 1);
}

async function cli() {
  // eslint-disable-next-line no-process-exit
  process.exit(await rabbitStatus());
}

module.exports = {
  liveness: cli,
  rabbitStatus
};
