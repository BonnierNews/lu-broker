"use strict";

const {crd, reject, internal} = require("../../lib/broker");

function waitForMessage(key, times = 1) {
  return new Promise((resolve) => {
    const messages = [];
    let num = 0;
    crd.subscribeTmp([key], (message, meta, notify) => {
      notify.ack();
      num++;
      messages.push({key: meta.fields.routingKey, msg: message, meta});
      if (num >= times) {
        return resolve(messages);
      }
    });
  });
}

function reset() {
  return new Promise((resolve) => {
    crd.unsubscribeAll(() => resolve());
  });
}

module.exports = {
  waitForMessage,
  reset
};
