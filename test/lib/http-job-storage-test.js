"use strict";
const storage = require("../../lib/http-job-storage");
const buildContext = require("../../lib/context");
const fakeApi = require("../helpers/fake-api");
const manifest = require("../data/http-job-storage-manifest");
const {assertRetry} = require("../../lib/test-helpers");

describe("http storage", () => {
  const context = buildContext({meta: {correlationId: "corrId"}}, {fields: {routingKey: "routingKey"}, properties: {}});
  it("should store a parent", async () => {
    const mount = fakeApi.mount(manifest.entity.storeParent);
    const parent = await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 2,
      context
    });

    mount.hasExpectedBody();
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      correlationId: "corrId"
    });
  });

  it("should store a parent with conflict", async () => {
    const mount = fakeApi.mount(manifest.entity.storeParentConflict);
    const parent = await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 2,
      context
    });

    mount.hasExpectedBody();
    parent.should.eql({
      childCount: 2,
      id: "routingKey:corrId",
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      correlationId: "corrId"
    });
  });

  it("should store a child job", async () => {
    fakeApi.mount(manifest.entity.storeParent);
    fakeApi.mount(manifest.entity.storeChild);
    await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 2,
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
      childCount: 2,
      id: "routingKey:corrId",
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      correlationId: "corrId",
      done: true
    });
  });

  it("should store a child job with conflict", async () => {
    fakeApi.mount(manifest.entity.storeParent);
    fakeApi.mount(manifest.entity.storeChildConflict);
    await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 2,
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
      childCount: 2,
      id: "routingKey:corrId",
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      correlationId: "corrId",
      done: true
    });
  });

  it("should retry on 404 status codes", async () => {
    fakeApi.mount(manifest.entity.storeParent);
    fakeApi.mount(manifest.entity.storeChildNotFound);
    await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 1,
      context
    });
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

  it("should retry on 500 status codes", async () => {
    fakeApi.mount(manifest.entity.storeParent);
    fakeApi.mount({...manifest.entity.storeChildNotFound, statusCode: 500});
    await storage.storeParent({
      message: {
        id: "some-id",
        type: "some-type"
      },
      responseKey: "response",
      childCount: 1,
      context
    });
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

  it("should retry storing a parent on 500 status code", async () => {
    fakeApi.mount({...manifest.entity.storeParent, statusCode: 500});
    await assertRetry(async () => {
      await storage.storeParent({
        message: {
          id: "some-id",
          type: "some-type"
        },
        responseKey: "response",
        childCount: 2,
        context
      });
    });
  });

  it("should retry storing a parent on 404 status code", async () => {
    fakeApi.mount({...manifest.entity.storeParent, statusCode: 404});
    await assertRetry(async () => {
      await storage.storeParent({
        message: {
          id: "some-id",
          type: "some-type"
        },
        responseKey: "response",
        childCount: 2,
        context
      });
    });
  });
});
