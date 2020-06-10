"use strict";

const config = require("exp-config");
const buildRedis = require("./redis");
const redis = buildRedis(config.redisConfig);

async function storeParent({message, responseKey, childCount, context}) {
  const {routingKey, correlationId} = context;
  const id = `${routingKey}:${correlationId}`;

  const parent = await redis.get(id);
  if (!parent) {
    const value = {
      id,
      message,
      correlationId,
      responseKey,
      childCount
    };
    await redis.set(id, value);
    return value;
  }

  return parent;
}

async function storeChild(message, context) {
  const {retryUnless} = context;
  const {notifyProcessed, correlationId} = message.meta;
  const childId = correlationId.split(":")[1];

  const parent = await redis.get(notifyProcessed);
  retryUnless(parent);

  const key = `children-${notifyProcessed}`;
  await redis.sadd(key, childId);
  const childCount = await redis.scard(key);
  return {...parent, done: childCount === parent.childCount};
}

async function reset() {
  return await redis.flushdb();
}

module.exports = {
  storeParent,
  storeChild,
  reset
};
