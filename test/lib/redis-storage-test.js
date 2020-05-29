"use strict";
const storage = require("../../lib/redis/redis-job-storage");
const buildContext = require("../../lib/context");

describe("redis job storage", () => {
  const context = buildContext({meta: {correlationId: "corrId"}}, {fields: {routingKey: "routingKey"}, properties: {}});

  afterEach(storage.reset);
  it("should store a parent", async () => {
    const parent = await storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context
    });
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response"
    });
  });

  it("should store a child job", async () => {
    await storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 1,
      context
    });

    const parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:0"
        }
      },
      context
    );
    parent.should.eql({
      childCount: 1,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: true
    });
  });

  it("should store children as child jobs", async () => {
    await storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context
    });

    let parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:0"
        }
      },
      context
    );
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: false
    });

    parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:1"
        }
      },
      context
    );

    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: true
    });
  });

  it("should handle multiple saves", async () => {
    await storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context
    });

    let parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:1"
        }
      },
      context
    );
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: false
    });

    parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:1"
        }
      },
      context
    );

    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response",
      done: false
    });
  });
});
