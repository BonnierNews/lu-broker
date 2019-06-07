"use strict";

const {start, route} = require("../..");
const {crd} = require("../helpers/queue-helper");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

function trigger(source) {
  return {
    type: "trigger",
    id: "event.some-name",
    source,
    meta: {
      correlationId: "some-correlation-id"
    }
  };
}

Feature("Triggers", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };
  Scenario("Trigger a flow with a trigger message", () => {
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
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", source);
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      msg.should.eql({
        type: "event",
        id: msg.id,
        data: [
          {
            type: "i-was-here",
            id: "my-guid",
            occurredAt: msg.data[0].occurredAt,
            key: "event.some-name.perform.one"
          }
        ],
        source,
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });
});
