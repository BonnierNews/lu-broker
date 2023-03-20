"use strict";

const config = require("exp-config");
const axios = require("axios");

async function rabbitStatus() {
  try {
    const response = await axios.get(`${config.rabbit.apiUrl}/api/connections`);

    if (response.statusCode !== 200) throw new Error(response.statusCode);
    const myConn = response.data.find((conn) => conn.client_properties.connection_name === config.HOSTNAME);
    if (!myConn) throw new Error(`Could not find rabbit connection for: ${config.HOSTNAME}`);
    return 0;
  } catch (err) {
    return 1;
  }
}

async function cli() {
  // eslint-disable-next-line no-process-exit
  process.exit(await rabbitStatus());
}

module.exports = cli;
