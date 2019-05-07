"use strict";

const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo", () => {
  let repo;
  const lambas = {
    "event.baz.perform.one": passThru,
    "event.baz.perform.two": passThru,
    "event.baz.perform.three": passThru,
    "event.bar.validate": passThru,
    "event.bar.perform.two": passThru
  };
  const events = [
    {
      name: "baz",
      namespace: "event",
      sequence: [".perform.one", ".perform.two", ".perform.three"]
    },
    {
      name: "bar",
      namespace: "event",
      sequence: [".validate", "event.baz.perform.one", ".perform.two"]
    }
  ];
  before(() => {
    repo = recipesRepo.init(events, lambas);
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
    repo.next("event.bar.validate").should.eql("event.bar.event.baz.perform.one");
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
      repo.first("event", "bar").should.eql("event.bar.validate");
    });
  });

  describe("getHandlerFunction", () => {
    it("should find a fn for a key", () => {
      repo.handler("event.baz.perform.one").should.eql(passThru);
      repo.handler("event.baz.perform.two").should.eql(passThru);
      repo.handler("event.baz.perform.three").should.eql(passThru);
      repo.handler("event.bar.validate").should.eql(passThru);
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
