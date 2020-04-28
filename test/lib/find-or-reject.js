"use strict";

const {findOrReject} = require("../../lib/find-attributes");

describe("find or reject", () => {
  function rejectUnless(b, m) {
    if (!b) throw new Error(m);
  }

  it("should find attribute if exists and not reject", () => {
    findOrReject(rejectUnless, [{type: "some__type", id: "some-id"}], "some__type").should.eql({
      type: "some__type",
      id: "some-id"
    });
  });
  it("should return prop value if key specified", () => {
    findOrReject(rejectUnless, [{type: "some__type", id: "some-id"}], "some__type", "id").should.eql("some-id");
  });

  it("should reject if key does not exist", () => {
    (function() {
      findOrReject(rejectUnless, [{type: "some__type", id: "some-id"}], "some__other-type", "id");
    }.should.throw(Error, /Need some__other-type id to proceed/));
  });

  it("should reject if attribute does not exist", () => {
    (function() {
      findOrReject(rejectUnless, [{type: "some__type", id: "some-id"}], "some__type", "some-other-key");
    }.should.throw(Error, /Need some__type some-other-key to proceed/));
  });

  it("should return 0 if the value is 0", () => {
    findOrReject(rejectUnless, [{type: "some__type", id: 0}], "some__type", "id").should.eql(0);
  });
});
