"use strict";

const chai = require("chai");
const broker = require("../test/helpers/queue-helper");

function waitForOrThrow(routingKey) {
  return new Promise((resolve, reject) => {
    broker.crd.subscribe(routingKey, (err, msg) => {
      if (err) throw err;
      return resolve(msg);
    });
    broker.reject.subscribe("#", (err, msg) => {
      if (err) throw err;
      return reject(new Error(JSON.stringify(msg, undefined, 2)));
    });
  });
}

async function assertRejected(fn) {
  try {
    await fn();
  } catch (error) {
    error.should.have.property("rejected");
    error.rejected.should.eql(true);
    return error;
  }
  throw new chai.AssertionError("not rejected");
}

async function assertRetry(fn) {
  try {
    await fn();
  } catch (error) {
    error.should.not.have.property("rejected");
    return error;
  }
  throw new chai.AssertionError("not retried");
}

function reset() {
  broker.crd.resetMock();
  broker.reject.resetMock();
}

module.exports = {assertRejected, assertRetry, broker: broker.crd, waitForOrThrow, reset};
