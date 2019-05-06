"use strict";

const recipesRepo = require("../../lib/recipe-repo");

describe("recipes-repo", () => {
  const events = [
    {
      name: "baz",
      namespace: "event",
      sequence: [".one", ".two", ".three"]
    },
    {
      name: "bar",
      namespace: "event",
      sequence: [".validate", "event.baz.one", ".two"]
    }
  ];

  const repo = recipesRepo.init(events);

  it("should get the next key for a simple event", () => {
    repo.next("event.baz.one").should.eql("event.baz.two");
    repo.next("event.baz.two").should.eql("event.baz.three");
  });
  it("should get processed as the next key for a simple event", () => {
    repo.next("event.baz.three").should.eql("event.baz.processed");
  });

  it("should get undefined as the next key when processed", () => {
    should.not.exist(repo.next("event.baz.processed"));
  });

  it("should get the next key for an event with included steps", () => {
    repo.next("event.bar.validate").should.eql("event.bar.event.baz.one");
    repo.next("event.bar.event.baz.one").should.eql("event.bar.two");
  });
  it("should get processed as the next key for a simple event with included steps", () => {
    repo.next("event.bar.two").should.eql("event.bar.processed");
  });
});
