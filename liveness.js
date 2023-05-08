"use strict";

const config = require("exp-config");
const axios = require("axios");

async function rabbitStatus() {
  try {
    const [authUrl, baseUrl] = config.rabbit.apiUrl.split("@");
    const [username, password] = authUrl.split("/")[2].split(":");
    const response = await axios.get(`http://${baseUrl}/api/connections`, {
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
