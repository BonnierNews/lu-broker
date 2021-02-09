"use strict";

const {route} = require("../../index");
const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;
const unrecoverable = (msg) => msg;

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
      sequence: [route(".validate.one", passThru), route("event.baz.perform.one"), route(".perform.two", passThru)]
    },
    {
      namespace: "event",
      name: "unrecoverable",
      sequence: [route(".validate.one", passThru), route("event.baz.perform.one"), route(".perform.two", passThru)],
      unrecoverable: [route("*", unrecoverable)]
    }
  ];
  const triggers = {
    "trigger.some-value": passThru
  };
  before(() => {
    repo = recipesRepo.init(events, triggers);
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
      repo.keys().should.eql(["event.baz.#", "event.bar.#", "event.unrecoverable.#"]);
    });
  });

  describe("triggerKeys", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      nullRepo.triggerKeys().should.eql([]);
    });

    it("should return only triggers if no events", () => {
      const nullRepo = recipesRepo.init([], {"trigger.baz": passThru});
      nullRepo.triggerKeys().should.eql(["trigger.baz"]);
    });

    it("should return each event-name as key", () => {
      repo
        .triggerKeys()
        .should.eql(["trigger.some-value", "trigger.event.baz", "trigger.event.bar", "trigger.event.unrecoverable"]);
    });
  });

  describe("processedKeys", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      nullRepo.processedKeys().should.eql([]);
    });

    it("should return nothing if no events", () => {
      const nullRepo = recipesRepo.init([], {"trigger.baz": passThru});
      nullRepo.processedKeys().should.eql([]);
    });

    it("should return each event-name as key", () => {
      repo.processedKeys().should.eql(["event.baz.processed", "event.bar.processed", "event.unrecoverable.processed"]);
    });
  });

  describe("processedUnrecoverableKeys", () => {
    it("should return empty if no events", () => {
      const nullRepo = recipesRepo.init([]);
      nullRepo.processedUnrecoverableKeys().should.eql([]);
    });

    it("should return nothing if no events", () => {
      const nullRepo = recipesRepo.init([], {"trigger.baz": passThru});
      nullRepo.processedUnrecoverableKeys().should.eql([]);
    });

    it("should return each recipe key with an unrecoverable handler as keys", () => {
      repo
        .processedUnrecoverableKeys()
        .should.eql([
          "event.unrecoverable.validate.one.unrecoverable.processed",
          "event.unrecoverable.event.baz.perform.one.unrecoverable.processed",
          "event.unrecoverable.perform.two.unrecoverable.processed"
        ]);
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

    it("should find a fn for a borrowed key even if defined before borrow", () => {
      const otherRepo = recipesRepo.init([
        {
          namespace: "event",
          name: "one",
          sequence: [route("event.two.perform.two")]
        },
        {
          namespace: "event",
          name: "two",
          sequence: [route(".perform.two", passThru)]
        }
      ]);
      otherRepo.handler("event.one.event.two.perform.two").should.eql(passThru);
    });
  });

  describe("workerQueues", () => {
    const otherRepo = recipesRepo.init([
      {
        namespace: "event",
        name: "dad",
        sequence: [route(".perform.one", passThru)]
      },
      {
        namespace: "sub-sequence",
        name: "one",
        sequence: [route(".perform.two", passThru)]
      },
      {
        namespace: "sub-sequence",
        name: "two",
        sequence: [route(".perform.three", passThru)]
      }
    ]);
    it("should key keys for sub-sequences", () => {
      otherRepo
        .workerQueues()
        .map(({key}) => key)
        .should.eql(["wq.trigger.sub-sequence.one", "wq.trigger.sub-sequence.two"]);
    });
    it("should get queuenames for sub-sequences", () => {
      otherRepo
        .workerQueues()
        .map(({queue}) => queue)
        .should.eql(["lu-broker-workqueue-one-test", "lu-broker-workqueue-two-test"]);
    });
  });

  describe("getUnrecoverableHandler", () => {
    before(() => {
      repo = recipesRepo.init(events, triggers);
    });
    it("should find a fn for a key", () => {
      repo.unrecoverableHandler("event.unrecoverable.validate.one").should.eql(unrecoverable);
      repo.unrecoverableHandler("event.unrecoverable.perform.two").should.eql(unrecoverable);
    });

    it("should not find a fn for an unknown key", () => {
      should.not.exist(repo.unrecoverableHandler("event.unrecoverable.epic-key"));
    });

    it("should find a fn for a borrowed key", () => {
      repo.unrecoverableHandler("event.unrecoverable.event.baz.perform.one").should.eql(unrecoverable);
    });
  });
});
