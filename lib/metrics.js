"use strict";

const prometheusClient = require("prom-client");
prometheusClient.collectDefaultMetrics();

const register = prometheusClient.register;
const counters = [];
const gauges = [];

function addCounter(name, help, labels = []) {
  const newCounter = new prometheusClient.Counter({
    name,
    help: help || "Counter",
    labelNames: labels,
  });

  counters.push(newCounter);
  return newCounter;
}

function addGauge(name, help, labels = []) {
  const newGauge = new prometheusClient.Gauge({
    name,
    help: help || "Gauge",
    labelNames: labels,
  });

  gauges.push(newGauge);
  return newGauge;
}

function getSingleMetric(name) {
  return register.getSingleMetric(name);
}

function getMetrics() {
  return { metrics: register.metrics(), contentType: register.contentType };
}

function clear() {
  register.resetMetrics();
  for (const counter of counters) {
    counter.reset();
  }
  for (const gauge of gauges) {
    gauge.reset();
  }
}

module.exports = {
  contentType: register.contentType,
  addCounter,
  addGauge,
  getMetrics,
  getSingleMetric,
  clear,
};
