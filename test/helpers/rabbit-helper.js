"use strict";

const {crd} = require("../../lib/broker");
const config = require("exp-config");
const http = require("../../lib/http");

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

// get queues that will not auto clear
async function getQueueNames() {
  const body = await http.asserted.get({baseUrl: config.rabbit.apiUrl, path: "/api/queues"});
  return body.filter((row) => !row.auto_delete).map((row) => row.name);
}

async function purgeQueues() {
  const promises = [];
  const names = await getQueueNames();
  for (const name of names) {
    promises.push(
      new Promise((resolve) => {
        crd.purgeQueue(name, resolve);
      })
    );
  }
  return Promise.all(promises);
}

async function deleteQueues() {
  const promises = [];
  const names = await getQueueNames();
  for (const name of names) {
    promises.push(
      new Promise((resolve) => {
        crd.deleteQueue(name, resolve);
      })
    );
  }
  return Promise.all(promises);
}

async function reset() {
  await new Promise((resolve) => {
    crd.unsubscribeAll(() => resolve());
  });
  await purgeQueues();
}

module.exports = {
  subscribe,
  purgeQueues,
  deleteQueues,
  reset
};
