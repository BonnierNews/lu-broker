"use strict";

const GoogleAuth = require("google-auth-library");

const auth = new GoogleAuth.GoogleAuth();

async function getGcpAuthHeaders(audience) {
  const client = await auth.getIdTokenClient(audience);
  return await client.getRequestHeaders();
}

module.exports = { getGcpAuthHeaders };
