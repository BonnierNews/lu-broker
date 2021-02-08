"use strict";

const {crd} = require("../../lib/broker");

function subscribe(key, times = 1) {
  return new Promise((setup, reject) => {
    const promise = new Promise((resolve) => {
      const messages = [];
      let num = 0;

      function getMessage(message, meta, notify) {
        notify.ack();
        num++;
        messages.push({key: meta.fields.routingKey, msg: message, meta});
        if (num >= times) {
          return resolve(messages);
        }
      }

      crd.subscribeTmp([key], getMessage, (err) => {
        if (err) return reject(err);
        return setup({
          waitForMessages: () => promise,
          messages
        });
      });
    });
  });
}

function reset() {
  return new Promise((resolve) => {
    crd.unsubscribeAll(() => resolve());
  });
}

module.exports = {
  subscribe,
  reset
};
