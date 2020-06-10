"use strict";
const storage = require("../../lib/memory-job-storage");

describe("memory storage", () => {
  beforeEach(storage.reset);
  it("should store a parent", () => {
    const parent = storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: "msg",
      correlationId: "corrId",
      responseKey: "response",
      children: parent.children
    });
  });

  it("should store a child job", () => {
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 1,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    const parent = storage.storeChild(
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
      correlationId: "corrId",
      message: "msg",
      responseKey: "response",
      done: true,
      children: parent.children
    });
  });

  it("should store children as child jobs", () => {
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    let parent = storage.storeChild(
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
      correlationId: "corrId",
      responseKey: "response",
      done: false,
      children: parent.children
    });

    parent = storage.storeChild(
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
      correlationId: "corrId",
      responseKey: "response",
      done: true,
      children: parent.children
    });
  });

  it("should handle multiple saves", () => {
    storage.storeParent({
      message: "msg",
      responseKey: "response",
      childCount: 2,
      context: {correlationId: "corrId", routingKey: "routingKey"}
    });

    let parent = storage.storeChild(
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
      correlationId: "corrId",
      responseKey: "response",
      done: false,
      children: parent.children
    });

    parent = storage.storeChild(
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
      correlationId: "corrId",
      responseKey: "response",
      done: false,
      children: parent.children
    });
  });
});
