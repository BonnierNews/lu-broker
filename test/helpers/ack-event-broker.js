"use strict";

const broker = require("../../broker");

const oldSub = broker.subscribe;
broker.subscribe = (routingKeyOrKeys, queue, handler, cb) => {
  const oldHandler = handler;
  handler = (message, meta, notify) => {
    const oldAck = notify.ack;
    const oldNack = notify.nack;
    notify.ack = () => {
      broker.emit("ack", message, meta, "ack");
      oldAck();
    };
    notify.nack = () => {
      broker.emit("nack", message, meta, "nack");
      oldNack();
    };
    oldHandler(message, meta, notify);
  };
  oldSub(routingKeyOrKeys, queue, handler, cb);
};

module.exports = broker;
