"use strict";

function append(correlationId, event, data, meta = {}, extra = {}) {
  data = Array.isArray(data) ? data : [data];
  const newEvent = Object.assign({data: []}, event);
  newEvent.data = newEvent.data.concat(data.map(asData));
  newEvent.meta = Object.assign(newEvent.meta, meta, {correlationId});
  return Object.assign(newEvent, extra);
}

function asData({id, type}) {
  if (!id) throw new Error(`Got null/undefined id for type ${type} when updating event, bailing`);
  if (!type) throw new Error(`Got null/undefined type for id ${id} when updating event, bailing`);
  return {id, type, occurredAt: new Date()};
}

module.exports = {
  append
};
