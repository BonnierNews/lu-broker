"use strict";

const assert = require("assert");
const caller = require("./caller");

function dieUnless(predicate, message) {
  if (typeof predicate === "function") {
    return dieUnless(predicate(), message);
  }
  try {
    assert(predicate, message);
  } catch (err) {
    err.rejected = true;
    err.source = caller();
    throw err;
  }
}

module.exports = dieUnless;
