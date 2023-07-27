"use strict";

const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");
const retryMessage = require("./retry-message");
const jobStorage = require("./job-storage");

function buildInternalHandler(recipes) {
  async function internalMessagesHandler(incoming, meta, notify) {
    const context = buildContext(incoming, meta);
    const { logger, routingKey } = context;
    logger.info(`Got internal-trigger ${JSON.stringify(incoming)} on ${routingKey}`);
    try {
      logger.info(`Got processed message with key ${routingKey}`);
      if (!jobStorage) return notify.ack();
      if (!routingKey.endsWith(".processed")) return notify.ack();
      if (!incoming.meta.notifyProcessed) return notify.ack();

      const { message, responseKey, correlationId, done } = await jobStorage.storeChild(incoming, context);
      // all child flows are processed resume the parent flow
      if (done) {
        meta.properties.correlationId = correlationId;
        await publish(responseKey, message, meta, context);
        logger.info(`Resumed ${responseKey} from ${routingKey} with source ${JSON.stringify(message)}`);
      } else {
        logger.info("Still waiting for all childs to be processed.");
      }
    } catch (err) {
      if (err.rejected) {
        return rejectMessage(broker.internalQueueName, err, incoming, context, meta, notify);
      }
      return retryMessage(err, incoming, context, notify);
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
        correlationId: meta.properties.correlationId || context.correlationId,
        headers,
        replyTo: recipes.next(responseKey),
      },
      context.debugMeta
    );
  }

  return internalMessagesHandler;
}

module.exports = buildInternalHandler;
