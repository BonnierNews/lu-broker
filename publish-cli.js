#!/usr/bin/env node
"use strict";

const fs = require("fs");
const key = process.argv[2];
const hasStdinIn = !process.stdin.isTTY;
const broker = require("./lib/broker").crd;

async function main() {
  if (hasStdinIn) {
    const message = JSON.parse(fs.readFileSync(0).toString());
    await publish(key, message);
  } else {
    if (!process.argv[3]) throw new Error("No message given!");
    const message = JSON.parse(process.argv[3]);
    await publish(key, message);
  }
}

async function publish(routingKey, message) {
  console.log("Publishing:", message, "on", routingKey); // eslint-disable-line
  await broker.publishMessage(routingKey, message);
}

module.exports = main;
