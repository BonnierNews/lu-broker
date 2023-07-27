"use strict";
const routes = require("../../lib/server/routes");

describe("http", () => {
  it("should have a metrics endpoint", () => {
    routes().should.have.property("/metrics");
  });

  it("should have a _debug endpoint", () => {
    routes().should.have.property("/_debug");
  });

  it("should mount each key", () => {
    routes([ "trigger.key" ]).should.have.property("/trigger/key");
  });

  it("should remove .event", () => {
    routes([ "trigger.event.key" ]).should.have.property("/trigger/event/key");
  });

  it("should mount multiple keys .event", () => {
    const r = routes([ "trigger.event.key", "trigger.foo", "trigger.event.baz" ]);
    Object.keys(r)
      .sort()
      .should.eql([ "/_debug", "/metrics", "/trigger/event/baz", "/trigger/event/key", "/trigger/foo" ]);
  });
});
