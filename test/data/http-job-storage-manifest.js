"use strict";

const storeParent = {
  request: {
    path: "/entity/v2/broker-job",
    method: "post",
    body: {
      childCount: 2,
      id: "routingKey:corrId",
      correlationId: "corrId",
      message: {
        type: "some-type",
        id: "some-id",
      },
      responseKey: "response",
    },
  },
  body: {
    type: "broker-job",
    id: "routingKey:corrId",
    attributes: {
      childCount: 2,
      message: {
        type: "some-type",
        id: "some-id",
      },
      responseKey: "response",
      correlationId: "corrId",
    },
    meta: { correlationId: "some-correlation-id" },
  },
};

const storeParentConflict = {
  ...storeParent,
  statusCode: 409,
  body: { ...storeParent.body, errors: [ { detail: "conflict" } ] },
};

const storeChild = {
  request: {
    path: "/entity/v2/broker-job/routingKey:corrId/0",
    method: "put",
  },
  body: {
    type: "broker-job",
    id: "routingKey:corrId",
    attributes: {
      childCount: 2,
      message: {
        type: "some-type",
        id: "some-id",
      },
      responseKey: "response",
      correlationId: "corrId",
      done: true,
    },
    meta: { correlationId: "some-correlation-id" },
  },
};

const storeChildConflict = {
  ...storeChild,
  statusCode: 409,
  body: { ...storeChild.body, errors: [ { detail: "conflict" } ] },
};

const storeChildNotFound = {
  ...storeChild,
  statusCode: 404,
  body: { errors: [ { detail: "Not Found" } ] },
};

const manifest = {
  entity: {
    storeParent,
    storeParentConflict,
    storeChild,
    storeChildConflict,
    storeChildNotFound,
  },
};

module.exports = manifest;
