"use strict";

async function storeParent({message, responseKey, childCount, context}) {
  const {http, retryUnless, routingKey, correlationId} = context;
  const response = await http.post({
    path: "/entity/v2/broker-job",
    body: {
      id: `${routingKey}:${correlationId}`,
      message,
      responseKey,
      childCount
    }
  });
  retryUnless([200, 201, 409].includes(response.statusCode));
  return response.body && response.body.attributes;
}

async function storeChild(message, context) {
  const {http, retryUnless} = context;
  const {notifyProcessed, correlationId} = message.meta;
  const childId = correlationId.split(":")[1];

  const response = await http.put({
    path: `/entity/v2/broker-job/${notifyProcessed}/${childId}`
  });
  retryUnless([200, 201, 409].includes(response.statusCode));
  return response.body && response.body.attributes;
}

module.exports = {
  storeParent,
  storeChild,
  reset: () => {}
};
