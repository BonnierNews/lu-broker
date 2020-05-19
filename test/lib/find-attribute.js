"use strict";

const {findAttribute} = require("../../lib/find-attributes");

describe("find attributes", () => {
  it("should find attribute if exists", () => {
    findAttribute([{type: "some__type", id: "some-id"}], "some__type").should.eql({
      type: "some__type",
      id: "some-id"
    });
  });
  it("should return prop value if key specified", () => {
    findAttribute([{type: "some__type", id: "some-id"}], "some__type", "id").should.eql("some-id");
  });
  it("should return null if attribute does not exist", () => {
    should.not.exist(findAttribute([{type: "some__type", id: "some-id"}], "some__other-type"));
  });

  it("should return null if key does not exist", () => {
    should.not.exist(findAttribute([{type: "some__type", id: "some-id"}], "some__type", "some-other-key"));
  });

  it("should return 0 if the value is 0", () => {
    findAttribute([{type: "some__type", id: 0}], "some__type", "id").should.eql(0);
  });
});
