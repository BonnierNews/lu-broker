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
  await redis.sadd(notifyProcessed, childId);
  const childCount = await redis.scard(notifyProcessed);

  return {...parent, done: childCount === parent.childCount};
}

async function reset() {}

module.exports = {
  storeParent,
  storeChild,
  reset
};
