"use strict";

const chai = require("chai");
const {crd} = require("../test/helpers/queue-helper");


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

function setup() {
  const fakeAmqp = require("exp-fake-amqplib");
  const proxyquire = require("proxyquire");
  proxyquire("exp-amqp-connection/bootstrap", {
    "amqplib/callback_api": fakeAmqp
  });
}

module.exports = {assertRejected, assertRetry, broker: crd, setup};
