"use strict";

const {envName} = require("exp-config");
let Redis = require("ioredis");

function resolve(redisConfig) {
  if (envName === "test") {
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
  const expireTime = 7 * 24 * 60 * 60 * 1000;
  const redis = resolve(redisConfig);

  const prefixName = getPrefixName() || "lu-broker";

  return {
    client: redis,
    sadd,
    scard,
    set,
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
    const result = await redis.sadd(prefix(key), serialize(value));
    await redis.psetex(prefix(key), expireTime, serialize(value));
    return result;
  }

  async function set(key, value) {
    return await redis.psetex(prefix(key), expireTime, serialize(value));
  }

  async function get(key) {
    const data = await redis.get(prefix(key));
    return deserialize(data);
  }

  async function scard(key) {
    return await redis.scard(key);
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
  return `${appName}:${envName}`;
}

module.exports = build;
