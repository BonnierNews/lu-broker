"use strict";

const broker = require("../../lib/broker");

const oldSub = broker.wq.subscribe;

function newSub(routingKeyOrKeys, queue, handler, cb) {
  const functions = [];
  let locked = false;

  function run() {
    if (!locked && functions.length > 0) {
      locked = true;
      const fn = functions.shift();
      fn();
    }
  }

  const oldHandler = handler;
  handler = (message, meta, notify) => {
    functions.push(() => oldHandler(message, meta, notify));
    const oldAck = notify.ack;
    const oldNack = notify.nack;
    notify.ack = () => {
      oldAck();
      locked = false;
      run();
    };
    notify.nack = (...args) => {
      oldNack(...args);
      locked = false;
      run();
    };
    run();
  };
  oldSub(routingKeyOrKeys, queue, handler, cb);
}

broker.wq.subscribe = newSub;
module.exports = broker;
