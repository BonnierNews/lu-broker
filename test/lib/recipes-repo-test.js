"use strict";

const recipesRepo = require("../../lib/recipe-repo");

describe("recipes-repo", () => {
  let repo;
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
  before(() => {
    repo = recipesRepo.init(events);
  });

  it("should return empty if no events", () => {
    const nullRepo = recipesRepo.init([]);
    should.not.exist(nullRepo.next("event.baz.one"));
  });

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

  describe("keys", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      nullRepo.keys().should.eql([]);
    });

    it("should return each event-name as key", () => {
      repo.keys().should.eql(["event.baz.#", "event.bar.#"]);
    });
  });

  describe("triggerKeys", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      nullRepo.triggerKeys().should.eql([]);
    });

    it("should return each event-name as key", () => {
      repo.triggerKeys().should.eql(["trigger.event.baz", "trigger.event.bar"]);
    });
  });

  describe("first", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      should.not.exist(nullRepo.first());
    });

    it("should return the first key of a flow", () => {
      repo.first("event", "baz").should.eql("event.baz.one");
      repo.first("event", "bar").should.eql("event.bar.validate");
    });
  });
});
