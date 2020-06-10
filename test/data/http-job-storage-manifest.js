"use strict";

const storeParent = {
  request: {
    path: "/entity/v2/broker-job",
    method: "post",
    body: {
      childCount: 2,
      id: "routingKey:corrId",
      correlationId: "corrId",
      message: "msg",
      responseKey: "response"
    }
  },
  body: {
    attributes: {
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response"
    }
  }
};

const storeParentConflict = {
  ...storeParent,
  statusCode: 409,
  body: {...storeParent.body, errors: [{detail: "conflict"}]}
};

const storeChild = {
  request: {
    path: "/entity/v2/broker-job/routingKey:corrId/0",
    method: "put",
    body: {
      childCount: 1,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: false
    }
  },
  body: {
    attributes: {
      childCount: 1,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: true
    }
  }
};

const storeChildConflict = {
  ...storeChild,
  statusCode: 409,
  body: {...storeChild.body, errors: [{detail: "conflict"}]}
};

const storeChildNotFound = {
  ...storeChild,
  statusCode: 404,
  body: {errors: [{detail: "Not Found"}]}
};

const manifest = {
  entity: {
    storeParent,
    storeParentConflict,
    storeChild,
    storeChildConflict,
    storeChildNotFound
  }
};

module.exports = manifest;
