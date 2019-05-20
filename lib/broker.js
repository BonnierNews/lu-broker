"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");
const initConnection = require("exp-amqp-connection");
const callingAppName = require(`${process.cwd()}/package.json`).name;
const {envName} = config;
const lambdasQueueName = `${callingAppName}-lambdas-${envName}`;
const triggersQueueName = `${callingAppName}-triggers-${envName}`;
const rejectQueueName = `${callingAppName}-rejects-${envName}`;

let hasSubscription;

const crdBehavior = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 100,
    logger,
    connectionName: config.HOSTNAME
  },
  config.rabbit
);

const rejectBehaviour = Object.assign(
  {
    confirm: true,
    ack: true,
    prefetch: 100,
    logger,
    connectionName: config.HOSTNAME
  },
  config.rabbitReject
);

function setupBroker(behavior) {
  const broker = initConnection(behavior);

  broker.on("error", (err) => {
    if (hasSubscription) {
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

  broker.publishMessage = function(
    key,
    message,
    meta,
    debugMeta = {meta: {correlationId: message.meta.correlationId}}
  ) {
    return new Promise((resolve, reject) => {
      broker.publish(key, message, meta, (brokerErr) => {
        if (brokerErr) {
          logger.emergency(
            `Failed to publish message with routingKey ${key}, error: ${brokerErr.toString()} message: ${JSON.stringify(
              message
            )}`,
            debugMeta
          );
          return reject(brokerErr);
        }
        logger.info(`Published message with routingKey: ${key} message: ${JSON.stringify(message)}`, debugMeta);
        resolve();
      });
    });
  };

  return broker;
}

module.exports = {
  crd: setupBroker(crdBehavior),
  reject: setupBroker(rejectBehaviour),
  lambdasQueueName,
  triggersQueueName,
  rejectQueueName
};
