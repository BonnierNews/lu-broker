"use strict";

require("./ack-event-broker");
const { crd, reject, internal } = require("../../lib/broker");
const fakeAmqp = require("exp-fake-amqplib");
const uuid = require("uuid");

function queue(broker) {
  const ackedMessages = [];
  const nackedMessages = [];
  const oldSub = broker.subscribe;

  broker.subscribe = (routingKeyOrKeys, q, handler, cb) => {
    const oldHandler = handler;
    handler = (message, meta, notify) => {
      const oldAck = notify.ack;
      const oldNack = notify.nack;
      notify.ack = () => {
        ackedMessages.push(message);
        broker.emit("ack", message, meta);
        oldAck();
      };
      notify.nack = () => {
        nackedMessages.push(message);
        broker.emit("nack", message, meta);
        oldNack();
      };
      oldHandler(message, meta, notify);
    };
    oldSub(routingKeyOrKeys, q, handler, cb);
  };

  function subscribe(routingKey, waitForNumMessages, done) {
    if (!done) {
      done = waitForNumMessages;
      waitForNumMessages = 1;
    }
    const messages = [];
    broker.subscribeTmp(routingKey, (msg, meta) => {
      messages.push({ key: meta.fields.routingKey, msg, meta });
      if (typeof done === "function" && messages.length >= waitForNumMessages) {
        const tmpFn = done;
        done = null; // reset done so it wont be called more than once.
        tmpFn(null, waitForNumMessages === 1 ? msg : messages);
      }
    });
    return messages;
  }

  function publishMessage(routingKey, message, done) {
    if (!done) {
      return new Promise((resolve) => publishWithMeta(routingKey, message, {}, resolve));
    }
    publishWithMeta(routingKey, message, {}, done);
  }

  function publishWithMeta(routingKey, message, meta, done) {
    meta.messageId = uuid.v4();
    if (typeof done === "function") {
      awaitMessage(meta.messageId, done);
    }
    broker.publish(routingKey, message, meta);
  }

  function awaitMessage(messageId, cb) {
    function messageProcessed(message, meta) {
      broker.removeListener("ack", messageProcessed);
      broker.removeListener("nack", messageProcessed);
      if (meta.properties.messageId === messageId) {
        return cb();
      } else {
        awaitMessage(messageId, cb);
      }
    }

    broker.once("ack", messageProcessed);
    broker.once("nack", messageProcessed);
  }

  function resetMock() {
    fakeAmqp.resetMock();
    ackedMessages.length = 0;
    nackedMessages.length = 0;
  }

  return {
    ackedMessages,
    nackedMessages,
    publishMessage,
    publishWithMeta,
    subscribe,
    resetMock,
  };
}

module.exports = {
  reject: queue(reject),
  crd: queue(crd),
  internal: queue(internal),
};
