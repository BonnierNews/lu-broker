"use strict";

const parents = {};

function storeParent({message, responseKey, childCount, context}) {
  const {routingKey, correlationId} = context;
  const id = `${routingKey}:${correlationId}`;
  if (!parents[id]) {
    parents[id] = {
      id,
      message,
      responseKey,
      childCount,
      children: new Set()
    };
  }
  return parents[id];
}

function storeChild(message, context) {
  const {retryUnless} = context;
  const {notifyProcessed, correlationId} = message.meta;
  const childId = correlationId.split(":")[1];

  const parent = parents[notifyProcessed];
  retryUnless(parent);
  parent.children.add(childId);

  return {...parent, done: parent.children.size === parent.childCount};
}

module.exports = {
  storeParent,
  storeChild
};
