"use strict";

const nock = require("nock");
const fakeApi = require("../helpers/fake-api");
const http = require("../../lib/http");

describe("http", () => {
  describe("asserted", () => {
    const correlationId = "http-test-asserted";

    it("should do get-requests", async () => {
      fakeApi.get("/some/path").reply(200, {ok: true});
      const result = await http.asserted.get({path: "/some/path", correlationId});
      result.should.eql({ok: true});
    });

    it("should do get-requests with query-string", async () => {
      fakeApi.get("/some/path").query({q: "some-query"}).times(2).reply(200, {ok: true});
      const result = await http.asserted.get({path: "/some/path", correlationId, qs: {q: "some-query"}});
      result.should.eql({ok: true});

      const next = await http.asserted.get({path: "/some/path?q=some-query", correlationId});
      next.should.eql({ok: true});
    });

    it("should fail on 500", (done) => {
      fakeApi.get("/some/path").reply(500, {ok: false});
      http.asserted
        .get({path: "/some/path", correlationId})
        .then(() => done("should not come here"))
        .catch(() => done());
    });

    it("should throw on 404", (done) => {
      fakeApi.get("/some/path").reply(404, {ok: true});
      http.asserted
        .get({path: "/some/path", correlationId})
        .then(() => done("should not come here"))
        .catch(() => done());
    });

    it("should do delete-requests", async () => {
      fakeApi.delete("/some/path").reply(200, {ok: true});
      const result = await http.asserted.del({path: "/some/path", correlationId});
      result.should.eql({ok: true});
    });

    ["PATCH", "POST", "PUT"].forEach((method) => {
      it(`should do ${method}-requests`, async () => {
        fakeApi[method.toLowerCase()]("/some/path", (body) => {
          body.should.eql({correlationId});
          return true;
        }).reply(200, {ok: true});
        const result = await http.asserted[method.toLowerCase()]({
          path: "/some/path",
          correlationId,
          body: {correlationId}
        });
        result.should.eql({ok: true});
      });

      [200, 201, 204, 301, 302].forEach((code) => {
        it(`should not fail on ${code}`, async () => {
          fakeApi[method.toLowerCase()]("/some/path", (body) => {
            body.should.eql({correlationId});
            return true;
          }).reply(code, {ok: true});
          const result = await http.asserted[method.toLowerCase()]({
            path: "/some/path",
            correlationId,
            body: {correlationId}
          });
          result.should.eql({ok: true});
        });
      });

      it("should throw on 404", (done) => {
        fakeApi[method.toLowerCase()]("/some/path").reply(404, {ok: true});
        http.asserted[method.toLowerCase()]({path: "/some/path", correlationId})
          .then(() => done("should not come here"))
          .catch(() => done());
      });
    });
  });

  describe("with results", () => {
    const correlationId = "http-test-verbs";

    it("should do get-requests", async () => {
      fakeApi.get("/some/path").reply(200, {ok: true});
      const result = await http.get({path: "/some/path", correlationId});
      result.statusCode.should.eql(200);
      result.body.should.eql({ok: true});
    });

    it("should do get-requests with query-string", async () => {
      fakeApi.get("/some/path").query({q: "some-query"}).times(2).reply(200, {ok: true});
      const result = await http.get({path: "/some/path", correlationId, qs: {q: "some-query"}});
      result.statusCode.should.eql(200);
      result.body.should.eql({ok: true});

      const next = await http.get({path: "/some/path?q=some-query", correlationId});
      next.statusCode.should.eql(200);
      next.body.should.eql({ok: true});
    });

    it("should fail on 500", async () => {
      fakeApi.get("/some/path").reply(500, {ok: false});
      const result = await http.get({path: "/some/path", correlationId});
      result.statusCode.should.eql(500);
      result.body.should.eql({ok: false});
    });

    it("should be 404", async () => {
      fakeApi.get("/some/path").reply(404, {ok: true});
      const result = await http.get({path: "/some/path", correlationId});
      result.statusCode.should.eql(404);
      result.body.should.eql({ok: true});
    });

    it("should do delete-requests", async () => {
      fakeApi.delete("/some/path").reply(200, {ok: true});
      const result = await http.del({path: "/some/path", correlationId});
      result.statusCode.should.eql(200);
      result.body.should.eql({ok: true});
    });

    ["PATCH", "POST", "PUT"].forEach((method) => {
      it(`should do ${method}-requests`, async () => {
        fakeApi[method.toLowerCase()]("/some/path", (body) => {
          body.should.eql({correlationId});
          return true;
        }).reply(200, {ok: true});
        const result = await http[method.toLowerCase()]({path: "/some/path", correlationId, body: {correlationId}});
        result.statusCode.should.eql(200);
        result.body.should.eql({ok: true});
      });

      it("should fail on 500", async () => {
        fakeApi[method.toLowerCase()]("/some/path").reply(500, {ok: false});
        const result = await http[method.toLowerCase()]({path: "/some/path", correlationId});
        result.statusCode.should.eql(500);
        result.body.should.eql({ok: false});
      });

      it("should be 404", async () => {
        fakeApi[method.toLowerCase()]("/some/path").reply(404, {ok: true});
        const result = await http[method.toLowerCase()]({path: "/some/path", correlationId});
        result.statusCode.should.eql(404);
        result.body.should.eql({ok: true});
      });
    });
  });

  describe("with baseUrl", () => {
    const correlationId = "http-test-with-base-url";
    it("should allow url as param", async () => {
      nock("http://other-api.example.com").get("/some/path").reply(200, {ok: true});
      const result = await http.get({baseUrl: "http://other-api.example.com", path: "/some/path", correlationId});
      result.statusCode.should.eql(200);
      result.body.should.eql({ok: true});
    });
  });
  afterEach(fakeApi.reset);
});
