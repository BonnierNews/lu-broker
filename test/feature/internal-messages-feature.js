"use strict";

const {start, route} = require("../..");
const {crd} = require("../helpers/queue-helper");
const broker = require("../../lib/broker");
const fakeApi = require("../helpers/fake-api");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

Feature("Internal messasges", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };
  function trigger() {
    return {
      type: "trigger",
      id: "event.some-name",
      source,
      meta: {
        correlationId: "some-correlation-id"
      }
    };
  }

  Scenario("Responding to a trigger message", () => {
    before(() => {
      crd.resetMock();
      start({
        triggers: {
          "trigger.some-generic-name": trigger
        },
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)]
          }
        ]
      });
    });

    let triggerMessages;
    Given("we are listening for trigger messages", () => {
      triggerMessages = crd.subscribe("trigger.#");
    });

    let postBody;
    And("the broker job server is responding", () => {
      fakeApi.post("/entity/v2/broker-job", (body) => (postBody = body)).reply(201, {});
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage(`${broker.internalPrefix}.internal.trigger-message`, {
        type: "internal-message",
        id: "event.processed.one:some-correlation-id",
        attributes: {
          source,
          trigger: "trigger.event.some-name",
          responseKey: "event.response-key",
          message: {id: "orig-message", type: "event"}
        },
        meta: {correlationId: "some-correlation-id"}
      });
    });

    Then("the internalMessages should be processed", () => {
      triggerMessages.length.should.eql(1);
      const {msg, key} = triggerMessages.pop();
      key.should.eql("trigger.event.some-name");
      msg.should.eql({
        ...source,
        meta: {
          correlationId: "some-correlation-id:0",
          notifyProcessed: "event.processed.one:some-correlation-id",
          parentCorrelationId: "some-correlation-id"
        }
      });
    });

    And("the post to broker-job should contain information needed to resume processing", () => {
      postBody.should.eql({
        id: "event.processed.one:some-correlation-id",
        responseKey: "event.response-key",
        message: {id: "orig-message", type: "event"}
      });
    });
  });

  Scenario("Responding to a processed message", () => {
    before(() => {
      crd.resetMock();
      fakeApi.reset();
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

    And("the broker job server is responding", () => {
      // this should be unique for every child job
      fakeApi.put("/entity/v2/broker-job/some-correlation-id:event.process.one").reply(200, {
        attributes: {
          responseKey: "event.some-name.perform.one",
          message: {id: "orig-message", type: "event", meta: {correlationId: "parent-corr"}}
        },
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    When("we publish a processed message", async () => {
      await crd.publishMessage("event.some-name.processed", {
        type: "event",
        id: "some-id",
        data: [],
        meta: {correlationId: "some-correlation-id", notifyProcessed: "some-correlation-id:event.process.one"}
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

    And("the job server should have been called", () => {
      fakeApi.pendingMocks().should.eql([]);
    });
  });
});
