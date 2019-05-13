"use strict";

const nock = require("nock");
const config = require("exp-config");

let api = nock(config.proxyUrl);

function reset() {
  nock.cleanAll();
  api = nock(config.proxyUrl);
}

function disableNetConnect() {
  nock.disableNetConnect();
  nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
}

function hasPendingCall(apiPath) {
  const pending = api.pendingMocks();
  return (
    pending.find((request) => {
      return request.indexOf(apiPath) !== -1;
    }) !== undefined
  );
}
module.exports = {
  api,
  pendingMocks: api.pendingMocks.bind(api),
  get: api.get.bind(api),
  post: api.post.bind(api),
  delete: api.delete.bind(api),
  patch: api.patch.bind(api),
  put: api.put.bind(api),
  disableNetConnect,
  hasPendingCall,
  reset
};
