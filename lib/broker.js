"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");
const initConnection = require("exp-amqp-connection");

const behavior = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 20,
    logger,
    connectionName: config.HOSTNAME
  },
  config.rabbit
);

const broker = initConnection(behavior);
let hasSubscription;

broker.on("error", (err) => {
  if (hasSubscription || config.envName === "test") {
    logger.error(`AMQP Error: ${err.message}, dying badly`);
    // eslint-disable-next-line no-console
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
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

broker.publishMessage = function(key, message, meta) {
  return new Promise((resolve, reject) => {
    broker.publish(key, message, meta, (brokerErr) => {
      if (brokerErr) {
        logger.emergency(`Failed to publish message with routingKey ${key}, error: ${brokerErr.toString()}`, {
          meta: message.meta
        });
        return reject(brokerErr);
      }
      logger.info(`Published message ${JSON.stringify(message)} with routingKey: ${key}`, {meta: message.meta});
      return resolve();
    });
  });
};

module.exports = broker;
