"use strict";

const config = require("exp-config");
const axios = require("axios");
const {logger} = require("lu-logger");
const callingAppName = require(`${process.cwd()}/package.json`).name;

async function rabbitStatus() {
  try {
    const protocol = config.rabbit.apiUrl.split(":")[0];
    const [authUrl, baseUrl] = config.rabbit.apiUrl.split("@");
    const [username, password] = authUrl.split("/")[2].split(":");
    const response = await axios.get(`${protocol}://${baseUrl}/api/connections`, {
      auth: {
        username,
        password
      }
    });
    if (response.status !== 200) throw new Error(response.status);
    const myConn = response.data.find((conn) => conn.client_properties.connection_name === config.HOSTNAME);
    if (!myConn) throw new Error(`Could not find rabbit connection for: ${config.HOSTNAME}`);
    return 0;
  } catch (err) {
    logger.error("Liveness failed - Rabbit Error", err, {meta: {requesterName: callingAppName}});
    return 1;
  }
}

async function cli() {
  // eslint-disable-next-line no-process-exit
  process.exit(await rabbitStatus());
}

module.exports = {
  liveness: cli,
  rabbitStatus
};
