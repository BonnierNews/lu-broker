"use strict";

const util = require("util");
const http = require("./http");

function partial(fn, correlationId) {
  return (context) => fn({...context, correlationId});
}

function client(debugMeta) {
  const correlationId = debugMeta && debugMeta.meta && debugMeta.meta.correlationId;
  if (!correlationId) throw new Error(util.format("No correlationId set!", debugMeta));

  const result = {asserted: {}};
  Object.keys(http).forEach((key) => {
    result[key] = partial(http[key], correlationId);
  });
  Object.keys(http.asserted).forEach((key) => {
    result.asserted[key] = partial(http.asserted[key], correlationId);
  });

  return result;
}

module.exports = client;
