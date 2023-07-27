"use strict";

function getRoutingKey(meta) {
  if (!meta || !meta.properties || !meta.fields) return;
  return (meta.properties.headers && meta.properties.headers["x-routing-key"]) || meta.fields.routingKey;
}

function getReplyToKey(meta) {
  if (!meta || !meta.properties || !meta.properties.replyTo) return;
  return meta.properties.replyTo;
}

module.exports = {
  getRoutingKey,
  getReplyToKey,
};
