"use strict";

const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo", () => {
  let repo;
  const lambas = {
    "event.baz.changeme.one": passThru,
    "event.baz.changeme.two": passThru,
    "event.baz.changeme.three": passThru,
    "event.bar.validate": passThru,
    "event.bar.changeme.two": passThru
  };
  const events = [
    {
      name: "baz",
      namespace: "event",
      sequence: [".changeme.one", ".changeme.two", ".changeme.three"]
    },
    {
      name: "bar",
      namespace: "event",
      sequence: [".validate", "event.baz.changeme.one", ".changeme.two"]
    }
  ];
  before(() => {
    repo = recipesRepo.init(events, lambas);
  });

  it("should return empty if no events", () => {
    const nullRepo = recipesRepo.init([]);
    should.not.exist(nullRepo.next("event.baz.changeme.one"));
  });

  it("should get the next key for a simple event", () => {
    repo.next("event.baz.changeme.one").should.eql("event.baz.changeme.two");
    repo.next("event.baz.changeme.two").should.eql("event.baz.changeme.three");
  });
  it("should get processed as the next key for a simple event", () => {
    repo.next("event.baz.changeme.three").should.eql("event.baz.processed");
  });

  it("should get undefined as the next key when processed", () => {
    should.not.exist(repo.next("event.baz.processed"));
  });

  it("should get the next key for an event with included steps", () => {
    repo.next("event.bar.validate").should.eql("event.bar.event.baz.changeme.one");
    repo.next("event.bar.event.baz.changeme.one").should.eql("event.bar.changeme.two");
  });
  it("should get processed as the next key for a simple event with included steps", () => {
    repo.next("event.bar.changeme.two").should.eql("event.bar.processed");
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
      repo.first("event", "baz").should.eql("event.baz.changeme.one");
      repo.first("event", "bar").should.eql("event.bar.validate");
    });
  });

  describe("getHandlerFunction", () => {
    it("should find a fn for a key", () => {
      repo.handler("event.baz.changeme.one").should.eql(passThru);
      repo.handler("event.baz.changeme.two").should.eql(passThru);
      repo.handler("event.baz.changeme.three").should.eql(passThru);
      repo.handler("event.bar.validate").should.eql(passThru);
      repo.handler("event.bar.changeme.two").should.eql(passThru);
    });

    it("should not find a fn for an unknown key", () => {
      should.not.exist(repo.handler("event.baz.epic-key"));
    });

    it("should find a fn for a borrowed key", () => {
      repo.handler("event.bar.event.baz.changeme.one").should.eql(passThru);
    });
  });
});
