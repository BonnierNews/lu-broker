"use strict";

const broker = require("../../lib/broker");
const fakeAmqp = require("exp-fake-amqplib");
const uuid = require("uuid");
const messages = [];
const ackedMessages = [];
const nackedMessages = [];

function subscribe(routingKey, done) {
  const localMessages = [];

  broker.subscribeTmp(routingKey, (msg, meta) => {
    localMessages.push({key: meta.fields.routingKey, msg, meta});
    messages.push(msg);
    if (typeof done === "function") {
      const tmpFn = done;
      done = null; // reset done so it wont be called more than once.
      tmpFn(null, msg);
    }
    // notify.ack();
  });

  return localMessages;
}

function subscribeAndStop(routingKey, done) {
  return subscribe(routingKey, done);
}

function publishMessage(routingKey, message, done) {
  return publishWithMeta(routingKey, message, {}, done);
}

function publishWithMeta(routingKey, message, meta, done) {
  return new Promise((resolve) => {
    meta.messageId = uuid.v4();
    awaitMessage(meta.messageId, () => {
      resolve();
      if (done && typeof done === "function") return done();
    });
    broker.publish(routingKey, message, meta);
  });
}

function awaitMessage(messageId, cb) {
  function messageProcessed(message, meta, reason) {
    broker.removeListener("ack", messageProcessed);
    broker.removeListener("nack", messageProcessed);
    if (reason === "ack") {
      ackedMessages.push(message);
    } else {
      nackedMessages.push(message);
    }
    if (meta.properties.messageId === messageId) {
      return cb();
    } else {
      awaitMessage(messageId, cb);
    }
  }

  broker.once("ack", messageProcessed);
  broker.once("nack", messageProcessed);
}

async function publishAndConsumeReply(routingKey, msg, expectedReply) {
  const replyTo = `reply.${uuid.v4()}`;
  const [name, namespace] = routingKey.split(".");
  expectedReply = expectedReply || replyTo;
  const errorKey = `${routingKey}.error`;
  const localMessages = subscribe([expectedReply, errorKey]);
  await publishWithMeta(routingKey, msg, {
    replyTo,
    headers: {
      eventName: `${name}.${namespace}`
    }
  });
  localMessages.length.should.eql(1);
  localMessages[0].key.should.eql(expectedReply);
  return localMessages;
}

function resetMock() {
  fakeAmqp.resetMock();
  messages.length = 0;
  ackedMessages.length = 0;
  nackedMessages.length = 0;
}

module.exports = {
  receivedMessages: messages,
  ackedMessages,
  nackedMessages,
  publishMessage,
  publishWithMeta,
  subscribe,
  subscribeAndStop,
  resetMock,
  publishAndConsumeReply
};
