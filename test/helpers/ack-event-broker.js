"use strict";

const broker = require("../../lib/broker");

const oldSub = broker.wq.subscribe;

function newSub(routingKeyOrKeys, queue, handler, cb) {
  const functions = [];
  let concurrent = 0;

  function next() {
    concurrent--;
    const fn = functions.shift();
    if (fn) fn();
  }

  function addFn(fn) {
    if (concurrent++ === 0) {
      return fn();
    }
    functions.push(fn);
  }

  const oldHandler = handler;
  handler = (message, meta, notify) => {
    const oldAck = notify.ack;
    const oldNack = notify.nack;
    notify.ack = () => {
      oldAck();
      next();
    };
    notify.nack = (...args) => {
      oldNack(...args);
      next();
    };
    addFn(() => oldHandler(message, meta, notify));
  };
  oldSub(routingKeyOrKeys, queue, handler, cb);
}

broker.wq.subscribe = newSub;
module.exports = broker;
