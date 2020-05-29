"use strict";

const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");
const {reset, storeParent, storeChild} = require("../../lib/job-storage");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

Feature("Internal messasges", () => {
  afterEachScenario(async () => {
    await stop();
    await reset();
  });

  Scenario("Responding to a processed message", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)]
          }
        ]
      });
    });

    let flowMessages;
    Given("we are listening for flow messages", () => {
      flowMessages = crd.subscribe("event.some-name.#");
    });

    And("the broker job server is responding", async () => {
      await storeParent({
        responseKey: "event.some-name.perform.one",
        message: {id: "orig-message", type: "event", meta: {correlationId: "parent-corr"}},
        childCount: 1,
        context: {routingKey: "event.process.one", correlationId: "some-correlation-id"}
      });
      await storeChild(
        {
          id: "orig-message",
          type: "event",
          meta: {correlationId: "some-correlation-id:0", notifyProcessed: "event.process.one:some-correlation-id"}
        },
        {
          retryUnless: () => {}
        }
      );
    });

    When("we publish a processed message", async () => {
      await crd.publishMessage("event.some-name.processed", {
        type: "event",
        id: "some-id",
        data: [],
        meta: {correlationId: "some-correlation-id:0", notifyProcessed: "event.process.one:some-correlation-id"}
      });
    });

    Then("we should get a resumed message", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.perform.one");
      msg.should.eql({
        id: "orig-message",
        type: "event",
        meta: {
          correlationId: "parent-corr"
        }
      });
    });
  });
});
