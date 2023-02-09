"use strict";

const assert = require("assert");
const caller = require("./caller");
const http = require("./http");
const config = require("exp-config");

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

async function caseIf(predicate, caseBody) {
  if (typeof predicate === "function") {
    return caseIf(predicate(), caseBody);
  }
  if (predicate) {
    try {
      assertCaseBody(caseBody);
    } catch (err) {
      err.rejected = true;
      err.source = caller();
      throw err;
    }
    const {namespace} = caseBody;
    delete caseBody.namespace;
    const {id: caseId} = await http.asserted.post({
      path: `${config.salesforceApiUrl}/${namespace}/case`,
      body: caseBody
    });
    const error = new Error(`Case created with id: ${caseId}`);
    error.caseCreated = caseId;
    error.source = caller();
    throw error;
  }
}

async function caseUnless(predicate, caseBody) {
  if (typeof predicate === "function") {
    return await caseUnless(predicate(), caseBody);
  }
  if (!predicate) {
    try {
      assertCaseBody(caseBody);
    } catch (err) {
      err.rejected = true;
      err.source = caller();
      throw err;
    }
    const {namespace} = caseBody;
    delete caseBody.namespace;
    const {id: caseId} = await http.asserted.post({
      path: `${config.salesforceApiUrl}/${namespace}/case`,
      body: caseBody
    });
    const error = new Error(`Case created with id: ${caseId}`);
    error.caseCreated = caseId;
    error.source = caller();
    throw error;
  }
}

function assertCaseBody(caseBody) {
  const requiredCaseProperties = [
    "namespace",
    "contact",
    "businessType",
    "origin",
    "subject",
    "priority",
    "description",
    "category",
    "sourceQueue",
    "owner"
  ];
  const allowedCaseProperties = [...requiredCaseProperties, "deploymentName", "externalReference"];

  const caseBodyKeys = Object.entries(caseBody).map((arr) => arr[0]);

  requiredCaseProperties.forEach((prop) => {
    assert(caseBodyKeys.includes(prop), `Case body doesn't contain the required property ${prop}`);
  });
  caseBodyKeys.forEach((prop) =>
    assert(allowedCaseProperties.includes(prop), `Case body contains the property ${prop} which isn't allowed`)
  );
}

module.exports = {
  rejectUnless,
  rejectIf,
  retryIf,
  retryUnless,
  unrecoverableUnless,
  unrecoverableIf,
  caseIf,
  caseUnless
};
