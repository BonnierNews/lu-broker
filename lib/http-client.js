"use strict";

const util = require("util");
const {http} = require("lu-common");

function partial(fn, meta) {
  return (context) => fn({...meta, ...context});
}

function client(debugMeta) {
  const correlationId = debugMeta && debugMeta.meta && debugMeta.meta.correlationId;
  if (!correlationId) throw new Error(util.format("No correlationId set!", debugMeta));
  const routingKey = debugMeta && debugMeta.meta && debugMeta.meta.routingKey;
  const result = {asserted: {}};
  Object.keys(http).forEach((key) => {
    result[key] = partial(http[key], {correlationId, routingKey});
  });
  Object.keys(http.asserted).forEach((key) => {
    result.asserted[key] = partial(http.asserted[key], {correlationId, routingKey});
  });

  return result;
}

module.exports = client;
