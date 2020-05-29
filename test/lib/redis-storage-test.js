"use strict";
const storage = require("../../lib/redis/redis-job-storage");

describe("redis job storage", () => {
  beforeEach(storage.reset);
  it("should store a parent", async () => {
    const parent = await storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      responseKey: "response"
    });
  });

  it("should store a child job", async () => {
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 1,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    const parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:0"
        }
      },
      {retryUnless: () => {}}
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
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    let parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:0"
        }
      },
      {retryUnless: () => {}}
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
      {retryUnless: () => {}}
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
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    let parent = await storage.storeChild(
      {
        meta: {
          notifyProcessed: "routingKey:corrId",
          correlationId: "corrId:1"
        }
      },
      {retryUnless: () => {}}
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
      {retryUnless: () => {}}
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
