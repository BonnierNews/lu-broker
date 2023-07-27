"use strict";

const sandbox = require("sinon").createSandbox();
const { start, route, stop } = require("../..");
const { crd, internal } = require("../helpers/queue-helper");
const memoryJobStorage = require("../../lib/job-storage");

function handler() {
  return { type: "i-was-here", id: "my-guid" };
}

Feature("Internal messasges", () => {
  afterEachScenario(async () => {
    await stop();
    await memoryJobStorage.reset();
    sandbox.restore();
  });

  Scenario("Responding to a processed message", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [ route(".perform.one", handler) ],
          },
        ],
      });
    });

    let flowMessages;
    Given("we are listening for flow messages", () => {
      flowMessages = crd.subscribe("event.some-name.#");
    });

    And("the broker job server is responding", async () => {
      await memoryJobStorage.storeParent({
        responseKey: "event.some-name.perform.one",
        message: { id: "orig-message", type: "event", meta: { correlationId: "parent-corr" } },
        childCount: 1,
        context: { routingKey: "event.process.one", correlationId: "some-correlation-id" },
      });
    });

    When("we publish a processed message", async () => {
      await crd.publishMessage("event.some-name.processed", {
        type: "event",
        id: "some-id",
        data: [],
        meta: { correlationId: "some-correlation-id:0", notifyProcessed: "event.process.one:some-correlation-id" },
      });
    });

    Then("we should get a resumed message", () => {
      flowMessages.length.should.eql(2);
      const { msg, key } = flowMessages.pop();
      key.should.eql("event.some-name.perform.one");
      msg.should.eql({
        id: "orig-message",
        type: "event",
        meta: { correlationId: "parent-corr" },
      });
    });
  });

  Scenario("Responding to a processed message, jobstorage error", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [ route(".perform.one", handler) ],
          },
        ],
      });
    });

    Given("there is a parent in the job storage", async () => {
      await memoryJobStorage.storeParent({
        responseKey: "event.some-name.perform.one",
        message: { id: "orig-message", type: "event", meta: { correlationId: "parent-corr" } },
        childCount: 1,
        context: { routingKey: "event.process.one", correlationId: "some-correlation-id" },
      });
    });

    And("store child throws an error", () => {
      sandbox.stub(memoryJobStorage, "storeChild").throws(new Error("borken storage"));
    });

    When("we publish a processed message", async () => {
      await crd.publishMessage("event.some-name.processed", {
        type: "event",
        id: "some-id",
        data: [],
        meta: { correlationId: "some-correlation-id:0", notifyProcessed: "event.process.one:some-correlation-id" },
      });
    });

    And("the messages should be nacked(false) and be the same as the processed message with an error", () => {
      internal.nackedMessages.length.should.eql(1);
      internal.nackedMessages[0].errors[0].title.should.eql("borken storage");
    });
  });
});
