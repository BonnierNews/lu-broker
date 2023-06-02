"use strict";

const fakeApi = require("../helpers/fake-api")();
const httpClient = require("../../lib/http-client");

describe("http-client, asserted", () => {
  const correlationId = "http-test";
  const routingKey = "some.cool.routing-key";
  const http = httpClient({meta: {correlationId, routingKey}});

  it("should do asserted get-requests", async () => {
    fakeApi
      .get("/some/path")
      .matchHeader("correlation-id", (val) => {
        val.should.eql(correlationId);
        return val;
      })
      .matchHeader("x-debug-meta-routing-key", (val) => {
        val.should.eql(routingKey);
        return val;
      })
      .reply(200, {ok: true});
    const result = await http.asserted.get({path: "/some/path"});
    result.should.eql({ok: true});
  });

  it("should do get-requests", async () => {
    fakeApi
      .get("/some/path")
      .matchHeader("correlation-id", (val) => {
        val.should.eql(correlationId);
        return val;
      })
      .matchHeader("x-debug-meta-routing-key", (val) => {
        val.should.eql(routingKey);
        return val;
      })
      .reply(200, {ok: true});
    const result = await http.get({path: "/some/path"});
    result.body.should.eql({ok: true});
  });

  ["PATCH", "POST", "PUT"].forEach((method) => {
    it(`should do ${method}-requests`, async () => {
      fakeApi[method.toLowerCase()]("/some/path", (body) => {
        body.should.eql({correlationId});
        return true;
      })
        .matchHeader("correlation-id", (val) => {
          val.should.eql(correlationId);
          return val;
        })
        .matchHeader("x-debug-meta-routing-key", (val) => {
          val.should.eql(routingKey);
          return val;
        })
        .reply(200, {ok: true});
      const result = await http.asserted[method.toLowerCase()]({path: "/some/path", body: {correlationId}});
      result.should.eql({ok: true});
    });

    it(`should do asserted ${method}-requests`, async () => {
      fakeApi[method.toLowerCase()]("/some/path", (body) => {
        body.should.eql({correlationId});
        return true;
      })
        .matchHeader("correlation-id", (val) => {
          val.should.eql(correlationId);
          return val;
        })
        .matchHeader("x-debug-meta-routing-key", (val) => {
          val.should.eql(routingKey);
          return val;
        })
        .reply(200, {ok: true});
      const result = await http.asserted[method.toLowerCase()]({path: "/some/path", body: {correlationId}});
      result.should.eql({ok: true});
    });
    it("should be possible to override correlationId", async () => {
      const customCorrelationId = "custom-correlation-id";
      fakeApi
        .get("/some/path")
        .matchHeader("correlation-id", (val) => {
          val.should.eql(customCorrelationId);
          return val;
        })
        .matchHeader("x-debug-meta-routing-key", (val) => {
          val.should.eql(routingKey);
          return val;
        })
        .reply(200, {ok: true});
      const result = await http.get({path: "/some/path", correlationId: customCorrelationId});
      result.body.should.eql({ok: true});
    });
  });

  afterEach(fakeApi.reset);
});
