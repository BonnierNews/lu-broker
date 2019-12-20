"use strict";

const fakeApi = require("./fake-api");
const {logger} = require("lu-logger");

function start() {
  const store = {};
  fakeApi.reset();

  fakeApi
    .post("/entity/v2/broker-job")
    .times(1000)
    .reply((uri, requestBody) => {
      const {id, responseKey, message} = requestBody;
      logger.info(`Noted job with id:${id}, responseKey:${responseKey}`);
      store[id] = {responseKey, message};
      return [201, {}];
    });

  fakeApi
    .put(/\/entity\/v2\/broker-job\/[^/]+/)
    .times(1000)
    .reply((uri) => {
      logger.info(`Got request to complete job with uri:${uri}`);
      const [, id] = uri.split("/entity/v2/broker-job/");
      if (store[id]) {
        return [
          200,
          {
            attributes: store[id]
          }
        ];
      }

      return [404, {}];
    });

  return fakeApi;
}

module.exports = {
  start,
  server: fakeApi,
  reset: fakeApi.reset.bind(fakeApi)
};
