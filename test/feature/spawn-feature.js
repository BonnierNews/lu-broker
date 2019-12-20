"use strict";

const {start, route} = require("../..");
const {crd} = require("../helpers/queue-helper");
const brokerServer = require("../helpers/broker-job-server");

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

function subTrigger() {
  return {
    type: "trigger",
    id: "event.grand-child",
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
      brokerServer.start();
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

    after(() => {
      brokerServer.reset();
    });
    let flowMessages, donePromise, internalMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
      internalMessages = crd.subscribe("#.internal.#");
      donePromise = new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    Then("we should get an internal trigger message", () => {
      internalMessages.should.have.length(1);
      const {key, msg} = internalMessages[0];
      key.should.eql("lu-broker.internal.trigger-message");
      msg.id.should.eql("event.some-name.perform.one:some-correlation-id");
      msg.attributes.should.eql({
        responseKey: "event.some-name.perform.two",
        trigger: "trigger.event.some-sub-name",
        source,
        message: {
          id: flowMessages[0].msg.id,
          type: "event",
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
          source: {id: source.id, type: source.type, attributes: source.attributes},
          meta: {
            correlationId: "some-correlation-id"
          }
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

  Scenario("Trigger a flow that triggers a flow by returning a trigger message from handler", () => {
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
      brokerServer.start();
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
            sequence: [route(".perform.one", subTrigger), route(".perform.two", addWithDelay(3, 1))]
          },
          {
            namespace: "event",
            name: "grand-child",
            sequence: [route(".perform.one", addWithDelay(4, 2))]
          }
        ]
      });
    });

    after(() => {
      brokerServer.reset();
    });
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      await new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    And("the flow should be completed", () => {
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

    Then("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 4, 3, 2]);
    });
  });
});
