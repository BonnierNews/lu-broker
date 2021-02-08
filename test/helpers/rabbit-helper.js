"use strict";

const {crd} = require("../../lib/broker");

function waitForMessage(key, times = 1) {
  return new Promise((setup, reject) => {
    const promise = new Promise((resolve) => {
      const messages = [];
      let num = 0;
      crd.subscribeTmp(
        [key],
        (message, meta, notify) => {
          notify.ack();
          num++;
          messages.push({key: meta.fields.routingKey, msg: message, meta});
          if (num >= times) {
            return resolve(messages);
          }
        },
        (err) => {
          if (err) return reject(err);
          return setup(() => promise);
        }
      );
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
