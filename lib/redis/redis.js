"use strict";

const config = require("exp-config");
let Redis = require("ioredis");

function resolve(redisConfig) {
  if (config.envName === "test") {
    Redis = require("ioredis-mock");
  }
  const {port, host, enableOfflineQueue, showFriendlyErrorStack} = redisConfig || {};
  return new Redis({
    port,
    host,
    showFriendlyErrorStack,
    enableOfflineQueue,
    enableReadyCheck: false
  });
}

function build(redisConfig) {
  const expireTime = 7 * 24 * 60 * 60 * 1000; // expire in a week
  const redis = resolve(redisConfig);

  const prefixName = getPrefixName() || "lu-broker";

  return {
    client: redis,
    sadd,
    scard,
    smembers,
    set,
    del,
    has,
    get,
    peek,
    flushdb
  };

  function peek(key) {
    return get(prefix(key));
  }

  function has(key) {
    return redis.get(prefix(key)).then((value) => {
      return value !== null;
    });
  }

  async function sadd(key, value) {
    const result = await redis.sadd(prefix(key), value);
    await redis.pexpire(prefix(key), expireTime);
    return result;
  }

  async function set(key, value) {
    return await redis.psetex(prefix(key), expireTime, serialize(value));
  }

  function smembers(key) {
    return redis.smembers(prefix(key));
  }

  async function get(key) {
    const data = await redis.get(prefix(key));
    return deserialize(data);
  }

  async function del(key) {
    return await redis.del(prefix(key));
  }

  function scard(key) {
    return redis.scard(prefix(key));
  }

  async function flushdb() {
    return await redis.flushdb();
  }

  function prefix(key) {
    return `${prefixName}:${key}`;
  }
}

function serialize(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  return JSON.stringify(value);
}

function deserialize(value) {
  if (value === null) {
    return undefined;
  }

  if (value === "undefined") {
    return "undefined";
  }

  return JSON.parse(value);
}

function getPrefixName() {
  const appName = require(`${process.cwd()}/package.json`).name;
  return `${appName}:${config.envName}`;
}

module.exports = build(config.redisConfig);
