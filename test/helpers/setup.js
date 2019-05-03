"use strict";

// Make sure dates are displayed in the correct timezone
process.env.TZ = "Europe/Stockholm";

// Tests should always run in test environment to prevent accidental deletion of
// real elasticsearch indices etc.
// This file is required with ./test/mocha.opts
process.env.NODE_ENV = "test";

// Setup common test libraries
require("mocha-cakes-2");

const chai = require("chai");
const chaiExclude = require("chai-exclude");
chai.use(chaiExclude);

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

Object.assign(global, {
  should: chai.should()
});

const fakeAmqp = require("exp-fake-amqplib");
const proxyquire = require("proxyquire");
proxyquire("exp-amqp-connection/bootstrap", {
  "amqplib/callback_api": fakeAmqp
});

require("./ack-event-broker");

// process.on("unhandledRejection", (err) => {
//   // eslint-disable-next-line no-console
//   console.log(`Caught rejection: ${err}`);
//   // eslint-disable-next-line no-console
//   console.error(err);
// });
