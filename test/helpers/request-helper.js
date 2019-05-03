"use strict";
const supertest = require("supertest");
const app = require("../../");
const pathLib = require("path");

function get(path, apiKey = "test-key") {
  return supertest(app)
    .get(path)
    .set("Content-Type", "application/json")
    .set("X-API-KEY", apiKey)
    .set("correlation-id", caller())
    .expect("Content-Type", /application\/json/);
}

function post(path, body, apiKey = "test-key") {
  const callingFunction = caller();
  return supertest(app)
    .post(path)
    .set("Content-Type", "application/json")
    .set("X-API-KEY", apiKey)
    .set("correlation-id", callingFunction)
    .send(body)
    .expect("Content-Type", /application\/json/)
    .expect("correlation-id", callingFunction);
}

function raw() {
  return supertest(app);
}

/**
 * Module wrapper of @substack's `caller.js` (stolen from https://github.com/totherik/caller/blob/master/index.js)
 * @original: https://github.com/substack/node-resolve/blob/master/lib/caller.js
 * @blessings: https://twitter.com/eriktoth/statuses/413719312273125377
 * @see https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
 */
function caller(depth) {
  let stack, file, frame;

  const pst = Error.prepareStackTrace;
  Error.prepareStackTrace = function prepareStackTrace(_, innerStack) {
    Error.prepareStackTrace = pst;
    return innerStack;
  };

  stack = new Error().stack;
  depth = !depth || isNaN(depth) ? 1 : depth > stack.length - 2 ? stack.length - 2 : depth;
  stack = stack.slice(depth + 1);

  do {
    frame = stack.shift();
    file = frame && frame.getFileName();
  } while (stack.length && file === "module.js");

  const calleePath = pathLib.relative(process.cwd(), file);

  return `./${calleePath}:${frame.getLineNumber()}`;
}

module.exports = {
  get,
  post,
  caller,
  raw
};
