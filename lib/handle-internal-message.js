"use strict";

const uuid = require("uuid");
const broker = require("./broker");
const buildContext = require("./context");
const rejectMessage = require("./reject-message");

// const mapping = {};
// mapping[`${broker.internalPrefix}.internal.trigger-message`] = internalMessagesHandler;

function fn(message, context) {}

async function internalMessagesHandler(source, meta, notify) {
  const context = buildContext(source, meta);
  const {logger, routingKey} = context;
  logger.info(`Got trigger ${JSON.stringify(source)} on ${routingKey}`);

  try {
    const response = fn(source, context);

    const newMeta = {correlationId: response.correlationId || context.correlationId};
    if (response.correlationId) newMeta.parentCorrelationId = context.correlationId;

    const message = {
      type: "namespace",
      id: uuid.v4(),
      data: [],
      meta: newMeta,
      source: response.source
    };
    await broker.crd.publishMessage(
      source.id,
      message,
      {
        correlationId: context.correlationId,
        replyTo: recipes.next(first)
      },
      context.debugMeta
    );
    logger.info(`Triggered ${first} from ${routingKey} with source ${JSON.stringify(source)}`);
  } catch (err) {
    return rejectMessage(err, source, context, meta, notify);
  }

  return notify.ack();
}

function generic(useParentCorrelationId) {
  return (source, context) => {
    const {routingKey} = context;
    const [, namespace, name] = routingKey.split(".");
    const res = {
      type: "trigger",
      id: `${namespace}.${name}`,
      source
    };
    if (useParentCorrelationId) res.correlationId = `${context.correlationId}:${uuid.v4()}`;
    return res;
  };
}

module.exports = internalMessagesHandler;
