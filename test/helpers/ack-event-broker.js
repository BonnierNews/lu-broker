"use strict";

const broker = require("../../lib/broker");

const oldSub = broker.wq.subscribe;

function newSub(routingKeyOrKeys, queue, handler, cb) {
  const functions = [];
  let locked = false;

  function run(fn) {
    if (locked) {
      functions.push(fn);
      return;
    } else if (fn) {
      locked = true;
      fn();
    }
  }

  const oldHandler = handler;
  handler = (message, meta, notify) => {
    const oldAck = notify.ack;
    const oldNack = notify.nack;
    notify.ack = () => {
      oldAck();
      locked = false;
      run(functions.shift());
    };
    notify.nack = (...args) => {
      oldNack(...args);
      locked = false;
      run(functions.shift());
    };
    run(() => oldHandler(message, meta, notify));
  };
  oldSub(routingKeyOrKeys, queue, handler, cb);
}

broker.wq.subscribe = newSub;
module.exports = broker;
