"use strict";
const supertest = require("supertest");
const app = "http://localhost:3000";
const pathLib = require("path");

function get(path) {
  return supertest(app)
    .get(path)
    .set("Content-Type", "application/json")
    .set("correlation-id", caller())
    .expect("Content-Type", /application\/json/);
}

function post(path, body, correlationId) {
  const callingFunction = caller();
  return supertest(app)
    .post(path)
    .set("Content-Type", "application/json")
    .set("correlation-id", correlationId || callingFunction)
    .send(body)
    .expect("Content-Type", /application\/json/)
    .expect("correlation-id", correlationId || callingFunction);
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
  if (!depth || isNaN(depth)) {
    depth = 1;
  } else {
    depth = depth > stack.length - 2 ? stack.length - 2 : depth;
  }
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
  raw,
};
