"use strict";

const assert = require("assert");
const caller = require("./caller");

function rejectUnless(predicate, message) {
  if (typeof predicate === "function") {
    return rejectUnless(predicate(), message);
  }
  try {
    assert(predicate, message);
  } catch (err) {
    err.rejected = true;
    err.source = caller();
    throw err;
  }
}

function rejectIf(predicate, message) {
  if (typeof predicate === "function") {
    return rejectIf(predicate(), message);
  }
  try {
    assert(!predicate, message);
  } catch (err) {
    err.rejected = true;
    err.source = caller();
    throw err;
  }
}

function unrecoverableUnless(predicate, message) {
  if (typeof predicate === "function") {
    return unrecoverableUnless(predicate(), message);
  }
  try {
    assert(predicate, message);
  } catch (err) {
    err.unrecoverable = true;
    err.source = caller();
    throw err;
  }
}

function unrecoverableIf(predicate, message) {
  if (typeof predicate === "function") {
    return unrecoverableIf(predicate(), message);
  }
  try {
    assert(!predicate, message);
  } catch (err) {
    err.unrecoverable = true;
    err.source = caller();
    throw err;
  }
}
function retryUnless(predicate, message) {
  if (typeof predicate === "function") {
    return retryUnless(predicate(), message);
  }
  try {
    assert(predicate, message);
  } catch (err) {
    err.source = caller();
    throw err;
  }
}

function retryIf(predicate, message) {
  if (typeof predicate === "function") {
    return retryIf(predicate(), message);
  }
  try {
    assert(!predicate, message);
  } catch (err) {
    err.source = caller();
    throw err;
  }
}

module.exports = {rejectUnless, rejectIf, retryIf, retryUnless, unrecoverableUnless, unrecoverableIf};
