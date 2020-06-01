"use strict";

const config = require("exp-config");
const assert = require("assert");
const {logger} = require("lu-logger");
const initConnection = require("exp-amqp-connection");
const callingAppName = require(`${process.cwd()}/package.json`).name;
const correlation = require("./correlation");
const {envName} = config;
const lambdasQueueName = `${callingAppName}-lambdas-${envName}`;
const triggersQueueName = `${callingAppName}-triggers-${envName}`;
const rejectQueueName = `${callingAppName}-rejects-${envName}`;
const internalQueueName = `${callingAppName}-internal-${envName}`;
const {addGauge} = require("./metrics");
const publishStats = addGauge("broker_publish", "Broker RabbitMQ publishing stats", ["appName", "success"]);
const appName = callingAppName && callingAppName.replace(/^@[^/]*\//, "").replace(/-/g, "");
const brokerBackend = config.brokerBackend || (config.envName === "test" ? "fake-rabbitmq" : "rabbitmq");
const allowedBrokerBackends = ["fake-rabbitmq", "rabbitmq"];
assert(
  allowedBrokerBackends.includes(brokerBackend),
  `Bad configuration ${brokerBackend} should be one of ${allowedBrokerBackends.join(",")}`
);

if (brokerBackend === "fake-rabbitmq") {
  const fakeAmqp = require("exp-fake-amqplib");
  const amqp = require("amqplib/callback_api");
  amqp.connect = fakeAmqp.connect;
}

let hasSubscription;

config.rabbit.queueArguments = config.rabbit.queueArguments || {};
config.rabbit.queueArguments["x-queue-master-locator"] =
  config.rabbit.queueArguments["x-queue-master-locator"] || "random";
const crdBehavior = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 10,
    logger,
    connectionName: config.HOSTNAME,
    resubscribeOnError: false
  },
  config.rabbit
);

config.rabbitReject.queueArguments = config.rabbitReject.queueArguments || {};
config.rabbitReject.queueArguments["x-queue-master-locator"] =
  config.rabbitReject.queueArguments["x-queue-master-locator"] || "random";

const rejectBehaviour = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 10,
    logger,
    connectionName: config.HOSTNAME,
    resubscribeOnError: false
  },
  config.rabbitReject
);

const internalBehavior = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 10,
    logger,
    connectionName: config.HOSTNAME,
    resubscribeOnError: false
  },
  config.rabbit
);

function setupBroker(behavior) {
  const broker = initConnection(behavior);

  broker.on("error", (err) => {
    if (hasSubscription) {
      logger.error(`AMQP Error: ${err.message}, dying badly`);
      // eslint-disable-next-line no-console
      console.error(err);
      // eslint-disable-next-line no-process-exit
      process.emit("SIGTERM");
    } else {
      logger.error(`AMQP Error: ${err.message}`);
    }
  });

  broker.on("callback_error", (err) => {
    logger.error(`AMQP Error: Error in callback sent to AMQP lib: ${err.message}`);
  });

  broker.on("connected", () => {
    logger.info(`Connected to AMQP server: ${JSON.stringify(config.rabbit)}`);
  });

  broker.on("subscribed", (subscription) => {
    hasSubscription = subscription;
    logger.info(`Subscription started: ${JSON.stringify(subscription)}`);
  });

  broker.publishMessage = function (key, message, meta, debugMeta) {
    correlation.ensureMessageCorrelation(message);
    debugMeta = debugMeta || {meta: {correlationId: message.meta.correlationId}};
    return new Promise((resolve, reject) => {
      const endStats = publishStats.startTimer({appName});
      const start = Date.now();
      logger.info(`Publishing message with routingKey: ${key}`, debugMeta);
      broker.publish(key, message, meta, (brokerErr) => {
        const end = Date.now();
        if (brokerErr) {
          logger.emergency(
            `Failed to publish message with routingKey ${key}, error: ${brokerErr.toString()} message: ${JSON.stringify(
              message
            )} after ${(end - start) / 1000} seconds`,
            debugMeta
          );
          endStats({success: false});
          return reject(brokerErr);
        }
        endStats({success: true});
        logger.info(
          `Published message with routingKey: ${key} message: ${JSON.stringify(message)} after ${
            (end - start) / 1000
          } seconds`,
          debugMeta
        );
        resolve();
      });
    });
  };

  return broker;
}

module.exports = {
  crd: setupBroker(crdBehavior),
  reject: setupBroker(rejectBehaviour),
  internal: setupBroker(internalBehavior),
  internalQueueName,
  lambdasQueueName,
  triggersQueueName,
  rejectQueueName
};
