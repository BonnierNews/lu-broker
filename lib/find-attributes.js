"use strict";

const assert = require("assert");
const util = require("util");

function findAttribute(collection, typeFilter, attribute = null) {
  collection = collection || [];
  assert(collection.find, util.format("Collection", collection, "does not have a find method"));
  const obj = collection.find(({ type }) => type === typeFilter);
  if (attribute === null) return obj;
  if ((obj && obj[attribute]) || (obj && typeof obj[attribute] === "number")) {
    return obj[attribute];
  }

  return null;
}
function findOrReject(rejectUnless, collection, typeFilter, attribute = null) {
  const result = findAttribute(collection, typeFilter, attribute);
  rejectUnless(result || typeof result === "number", `Need ${typeFilter} ${attribute} to proceed`);
  return result;
}

module.exports = { findOrReject, findAttribute };
