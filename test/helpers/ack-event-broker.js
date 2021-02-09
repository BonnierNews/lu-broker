"use strict";

const broker = require("../../lib/broker");

const oldSub = broker.wq.subscribe;

function newSub(routingKeyOrKeys, queue, handler, cb) {
  const functions = [];
  let first = true;

  function next() {
    const fn = functions.shift();
    if (fn) fn();
  }

  function addFn(fn) {
    if (first) {
      first = false;
      return fn();
    }
    functions.push(fn);
  }

  const oldHandler = handler;
  handler = (message, meta, notify) => {
    const oldAck = notify.ack;
    const oldNack = notify.nack;
    notify.ack = () => {
      broker.wq.emit("ack", message, meta, "ack");
      oldAck();
      next();
    };
    notify.nack = (...args) => {
      broker.wq.emit("nack", message, meta, "nack");
      oldNack(...args);
      next();
    };
    addFn(() => oldHandler(message, meta, notify));
  };
  oldSub(routingKeyOrKeys, queue, handler, cb);
}

broker.wq.subscribe = newSub;
module.exports = broker;
