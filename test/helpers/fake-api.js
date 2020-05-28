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

function mount(testData) {
  if (Array.isArray(testData)) {
    return testData.map(mount);
  }
  let actualBody;
  const {request} = testData;
  const mock = api[request.method.toLowerCase()](request.path, (body) => {
    actualBody = body;
    return true;
  });

  if (request.query) {
    mock.query(request.query);
  }

  if (request.headers) {
    for (const [key, val] of Object.entries(request.headers)) {
      mock.matchHeader(key, val);
    }
  }

  if (testData.times) {
    mock.times(testData.times);
  }

  mock.reply(testData.statusCode || testData.status || 200, testData.body);
  return {
    api: mock,
    hasExpectedBody: (body) => {
      return actualBody.should.eql(body || request.body);
    },
    postedBody: () => actualBody
  };
}
module.exports = {
  api,
  pendingMocks: api.pendingMocks.bind(api),
  mount,
  get: api.get.bind(api),
  post: api.post.bind(api),
  delete: api.delete.bind(api),
  patch: api.patch.bind(api),
  put: api.put.bind(api),
  disableNetConnect,
  hasPendingCall,
  reset
};
