"use strict";
const storage = require("../../lib/redis/redis-job-storage");
const redis = require("../../lib/redis/redis");
const buildContext = require("../../lib/context");
const {assertRetry} = require("../../lib/test-helpers");

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
      correlationId: "corrId",
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
          correlationId: "corrId:22"
        }
      },
      context
    );
    parent.should.eql({
      childCount: 1,
      id: "routingKey:corrId",
      message: "msg",
      correlationId: "corrId",
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
      correlationId: "corrId",
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
      correlationId: "corrId",
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
      correlationId: "corrId",
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
      correlationId: "corrId",
      responseKey: "response",
      done: false
    });
  });

  describe("envoy partitioning handling", () => {
    it("should handle parent is absent when storing child", async () => {
      await storage.storeParent({
        message: "msg",
        responseKey: "response",
        childCount: 2,
        context
      });
      redis.del(`${context.routingKey}:${context.correlationId}`);

      await assertRetry(async () => {
        await storage.storeChild(
          {
            meta: {
              notifyProcessed: "routingKey:corrId",
              correlationId: "corrId:0"
            }
          },
          context
        );
      });
    });

    it("should handle child is absent when storing child", async () => {
      await storage.storeParent({
        message: "msg",
        responseKey: "response",
        childCount: 2,
        context
      });
      await storage.storeChild(
        {
          meta: {
            notifyProcessed: "routingKey:corrId",
            correlationId: "corrId:1"
          }
        },
        context
      );

      redis.del(`children-${context.routingKey}:${context.correlationId}`);

      await assertRetry(async () => {
        await storage.storeChild(
          {
            meta: {
              notifyProcessed: "routingKey:corrId",
              correlationId: "corrId:0"
            }
          },
          context
        );
      });
    });
  });
});
