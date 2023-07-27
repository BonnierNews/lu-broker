"use strict";

const redis = require("./redis");

async function storeParent({ message, responseKey, childCount, context }) {
  const { routingKey, correlationId } = context;
  const id = `${routingKey}:${correlationId}`;
  const child = childKey(id);

  if (!(await redis.has(child))) {
    // Since there is no notion of an emty set in Redis
    // We use this string-hack.
    await redis.sadd(child, "emtpy set");
  }

  const parent = await redis.get(id);
  if (!parent) {
    const value = {
      id,
      message,
      correlationId,
      responseKey,
      childCount,
    };
    await redis.set(id, value);
    return value;
  }

  return parent;
}

async function storeChild(message, context) {
  const { retryUnless } = context;
  const { notifyProcessed, correlationId } = message.meta;
  const childId = correlationId.split(":")[1];

  const parent = await redis.get(notifyProcessed);
  retryUnless(parent);

  const child = childKey(notifyProcessed);
  const hasChild = await redis.has(child);
  retryUnless(hasChild);
  await redis.sadd(child, childId);
  const childCount = (await redis.scard(child)) - 1;
  return { ...parent, done: childCount === parent.childCount };
}

async function reset() {
  return await redis.flushdb();
}

function childKey(...keys) {
  return `children-${keys.join(":")}`;
}

module.exports = {
  storeParent,
  storeChild,
  reset,
};
