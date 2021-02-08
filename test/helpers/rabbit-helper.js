"use strict";

const {crd, reject, internal} = require("../../lib/broker");

function waitForMessage(key, times = 1) {
  const messages = [];
  let num = 0;
  return new Promise((resolve) => {
    crd.subscribe([key], "test-queue", (message, meta, notify) => {
      notify.ack();
      num++;
      messages.push({key: meta.fields.routingKey, msg: message, meta});
      console.log({key, routingKey: meta.fields.routingKey});
      if (num === times) {
        return resolve(messages);
      }
    });
  });
}

function reset() {
  return new Promise((resolve) => {
    crd.unsubscribeAll(() => {
      return resolve();
    });
  });
}

module.exports = {
  waitForMessage,
  reset
};
