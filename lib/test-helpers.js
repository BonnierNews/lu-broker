"use strict";

const chai = require("chai");
const util = require("util");
const broker = require("../test/helpers/queue-helper");

function waitForOrThrow(routingKey, waitForNumMessages) {
  return new Promise((resolve, reject) => {
    broker.crd.subscribe(routingKey, waitForNumMessages, (err, msg) => {
      if (err) throw err;
      resolve(msg);
    });
    broker.reject.subscribe("#", (err, msg) => {
      if (err) throw err;
      return reject(new Error(JSON.stringify(msg, undefined, 2)));
    });
  });
}

async function run(sequenceName, message, waitFor = "#.processed", waitForNumMessages = 1) {
  const trigger = sequenceName.startsWith("trigger.") ? sequenceName : `trigger.${sequenceName}`;
  const waitPromise = waitForOrThrow(waitFor, waitForNumMessages);
  await util.promisify(broker.crd.publishMessage)(trigger, message);
  return await waitPromise;
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

async function assertUnrecoverable(fn) {
  try {
    await fn();
  } catch (error) {
    error.should.have.property("unrecoverable");
    error.unrecoverable.should.eql(true);
    return error;
  }
  throw new chai.AssertionError("not unrecoverable");
}

async function assertCaseCreated(fn) {
  try {
    await fn();
  } catch (error) {
    error.should.have.property("caseCreated");
    return error;
  }
  throw new chai.AssertionError("Case not created");
}

module.exports = { assertCaseCreated, assertRejected, assertRetry, assertUnrecoverable, run };
