"use strict";

const {start, route} = require("../..");
const {crd} = require("../helpers/queue-helper");

// function handler() {
//   return {type: "main-event", id: "my-guid"};
// }
// function subHandler() {
//   return {type: "sub-event", id: "my-other-guid"};
// }

const source = {
  type: "order",
  id: "some-id",
  meta: {correlationId: "some-correlation-id"},
  attributes: {baz: true}
};
function trigger() {
  return {
    type: "trigger",
    id: "event.some-sub-name",
    source,
    meta: {
      correlationId: "some-correlation-id"
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
Feature("Spawn flows with triggers", () => {
  Scenario("Trigger a flow by returning a trigger message from handler", () => {
    const result = [];
    function addWithDelay(i, delay = 0) {
      return async () => {
        await sleep(delay);
        result.push(i);
        return {type: "baz", id: `my-guid-${i}`};
      };
    }

    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [
              route(".perform.first", addWithDelay(0, 1)),
              route(".perform.one", trigger),
              route(".perform.two", addWithDelay(2, 1))
            ]
          },
          {
            namespace: "event",
            name: "some-sub-name",
            sequence: [route(".perform.one", addWithDelay(1, 5))]
          }
        ]
      });
    });
    let flowMessages, donePromise, internalMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
      internalMessages = crd.subscribe("internal.#");
      donePromise = new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    Then("we should get an internal trigger message", () => {
      const {key, msg} = internalMessages[0];
      key.should.eql("internal.trigger-message");
      msg.id.should.eql("trigger.event.some-sub-name");
      msg.source.should.eql(source);
      msg.attributes.should.eql({
        responseKey: "event.some-name.perform.two",
        message: {
          data: [
            {
              id: "my-guid-0",
              key: "event.some-name.perform.first",
              occurredAt: msg.attributes.message.data[0].occurredAt,
              type: "baz"
            },
            {
              id: "event.some-sub-name",
              key: "event.some-name.perform.one",
              occurredAt: msg.attributes.message.data[1].occurredAt,
              type: "trigger"
            }
          ],
          id: flowMessages[0].msg.id,
          meta: {
            correlationId: "some-correlation-id"
          },
          source,
          type: "event"
        }
      });
    });

    And("the flow should be completed", async () => {
      await donePromise;
      flowMessages.length.should.eql(4);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      msg.data
        .map(({type, id}) => ({type, id}))
        .should.eql([
          {type: "baz", id: "my-guid-0"},
          {type: "trigger", id: "event.some-sub-name"},
          {type: "baz", id: "my-guid-2"}
        ]);
    });

    And("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 1, 2]);
    });
  });
});
