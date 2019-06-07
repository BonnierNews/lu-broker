"use strict";

const {route} = require("../../index");
const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo", () => {
  let repo;
  const events = [
    {
      namespace: "event",
      name: "baz",
      sequence: [route(".perform.one", passThru), route(".perform.two", passThru), route(".perform.three", passThru)]
    },
    {
      namespace: "event",
      name: "bar",
      sequence: [
        route(".validate.one", passThru),
        route("event.baz.perform.one", passThru),
        route(".perform.two", passThru)
      ]
    }
  ];
  before(() => {
    repo = recipesRepo.init(events);
  });

  it("should return empty if no events", () => {
    const nullRepo = recipesRepo.init([]);
    should.not.exist(nullRepo.next("event.baz.perform.one"));
  });

  it("should get the next key for a simple event", () => {
    repo.next("event.baz.perform.one").should.eql("event.baz.perform.two");
    repo.next("event.baz.perform.two").should.eql("event.baz.perform.three");
  });
  it("should get processed as the next key for a simple event", () => {
    repo.next("event.baz.perform.three").should.eql("event.baz.processed");
  });

  it("should get undefined as the next key when processed", () => {
    should.not.exist(repo.next("event.baz.processed"));
  });

  it("should get the next key for an event with included steps", () => {
    repo.next("event.bar.validate.one").should.eql("event.bar.event.baz.perform.one");
    repo.next("event.bar.event.baz.perform.one").should.eql("event.bar.perform.two");
  });
  it("should get processed as the next key for a simple event with included steps", () => {
    repo.next("event.bar.perform.two").should.eql("event.bar.processed");
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
      repo.first("event", "baz").should.eql("event.baz.perform.one");
      repo.first("event", "bar").should.eql("event.bar.validate.one");
    });
  });

  describe("getHandlerFunction", () => {
    it("should find a fn for a key", () => {
      repo.handler("event.baz.perform.one").should.eql(passThru);
      repo.handler("event.baz.perform.two").should.eql(passThru);
      repo.handler("event.baz.perform.three").should.eql(passThru);
      repo.handler("event.bar.validate.one").should.eql(passThru);
      repo.handler("event.bar.perform.two").should.eql(passThru);
    });

    it("should not find a fn for an unknown key", () => {
      should.not.exist(repo.handler("event.baz.epic-key"));
    });

    it("should find a fn for a borrowed key", () => {
      repo.handler("event.bar.event.baz.perform.one").should.eql(passThru);
    });
  });
});
