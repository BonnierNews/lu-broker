"use strict";

const chai = require("chai");
const util = require("util");
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

async function run(sequenceName, message, waitFor = "#.processed") {
  const trigger = sequenceName.startsWith("trigger.") ? sequenceName : `trigger.${sequenceName}`;
  const waitPromise = waitForOrThrow(waitFor);
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

module.exports = {assertRejected, assertRetry, run};
