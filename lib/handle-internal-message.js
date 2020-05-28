"use strict";

const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");
const {storeChild} = require("./job-storage");

function buildInternalHandler(recipes) {
  async function internalMessagesHandler(incoming, meta, notify) {
    const context = buildContext(incoming, meta);
    const {logger, routingKey} = context;
    logger.info(`Got internal-trigger ${JSON.stringify(incoming)} on ${routingKey}`);

    try {
      if (!routingKey.endsWith(".processed")) return notify.ack();
      if (!incoming.meta.notifyProcessed) return notify.ack();

      logger.info(`Got processed message with key ${routingKey}`);
      const envelope = await storeChild(incoming, context);
      const {message, responseKey, done} = envelope;
      //all child flows are processed resume the parent flow
      if (done) {
        await publish(responseKey, message, meta, context);
        logger.info(`Resumed ${responseKey} from ${routingKey} with source ${JSON.stringify(message)}`);
      } else {
        logger.info("Still waiting for all childs to be processed.");
      }
    } catch (err) {
      return rejectMessage(broker.lambdasQueueName, err, incoming, context, meta, notify);
    }

    return notify.ack();
  }
  async function publish(responseKey, message, meta, context) {
    if (!message) return;
    const headers = meta.properties.headers || {};
    delete headers["x-routing-key"];
    return await broker.crd.publishMessage(
      responseKey,
      message,
      {
        correlationId: context.correlationId,
        headers,
        replyTo: recipes.next(responseKey)
      },
      context.debugMeta
    );
  }

  return internalMessagesHandler;
}

module.exports = buildInternalHandler;
