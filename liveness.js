"use strict";

const config = require("exp-config");
const axios = require("axios");
const { logger } = require("lu-logger");
const callingAppName = require(`${process.cwd()}/package.json`).name;

async function rabbitStatus() {
  try {
    const response = await axios({
      url: `${config.rabbit.apiUrl}/api/connections`,
      method: "get",
    });
    if (response.status !== 200) throw new Error(response.status);
    const myConn = response.data.find((conn) => conn.client_properties.connection_name === config.HOSTNAME);
    if (!myConn) throw new Error(`Could not find rabbit connection for: ${config.HOSTNAME}`);
    return 0;
  } catch (err) {
    logger.error("Liveness failed - Rabbit Error", err, { meta: { requesterName: callingAppName } });
    return 1;
  }
}

async function cli() {
  // eslint-disable-next-line n/no-process-exit
  process.exit(await rabbitStatus());
}

module.exports = {
  liveness: cli,
  rabbitStatus,
};
