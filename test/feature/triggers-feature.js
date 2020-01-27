"use strict";

const {start, route} = require("../..");
const {crd} = require("../helpers/queue-helper");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

Feature("Triggers", () => {
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

  function triggerMultiple(incomingSource) {
    const triggers = [];
    for (let i = 0; i < incomingSource.numToTrigger; i++) {
      triggers.push({
        type: "trigger",
        id: "event.some-name",
        source: {...incomingSource, index: i},
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    }
    return triggers;
  }

  function triggerWithCorrelationId() {
    return {
      type: "trigger",
      id: "event.some-name",
      source,
      correlationId: "some-other-correlation-id"
    };
  }

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

  Scenario("Trigger a flow with a trigger message, spawn multiple sequences (2)", () => {
    before(() => {
      crd.resetMock();
      start({
        triggers: {
          "trigger.some-generic-name": triggerMultiple
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
      await crd.publishMessage("trigger.some-generic-name", {...source, numToTrigger: 2});
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(4);
      const idxs = flowMessages.filter(({key}) => key === "event.some-name.processed").map(({msg}) => msg.source.index);
      idxs.sort();
      idxs.should.eql([0, 1]);
    });
  });

  Scenario("Trigger a flow with a trigger message, spawn no sequences", () => {
    before(() => {
      crd.resetMock();
      start({
        triggers: {
          "trigger.some-generic-name": triggerMultiple
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
      await crd.publishMessage("trigger.some-generic-name", {...source, numToTrigger: 0});
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(0);
    });
  });

  Scenario("Trigger a flow with a parent correlation id", () => {
    before(() => {
      crd.resetMock();
      start({
        triggers: {
          "trigger.some-other-generic-name": triggerWithCorrelationId
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
      await crd.publishMessage("trigger.some-other-generic-name", source);
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
          correlationId: "some-other-correlation-id",
          parentCorrelationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow with a sequence generic parent correlation id", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)],
            useParentCorrelationId: true
          }
        ]
      });
    });
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      const newCorrId = msg.meta.correlationId.split(":")[1];
      newCorrId.should.be.a.uuid("v4");
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
          correlationId: `some-correlation-id:${newCorrId}`,
          parentCorrelationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow with a global use generic parent correlation id", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)]
          }
        ],
        useParentCorrelationId: true
      });
    });
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      const newCorrId = msg.meta.correlationId.split(":")[1];
      newCorrId.should.be.a.uuid("v4");
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
          correlationId: `some-correlation-id:${newCorrId}`,
          parentCorrelationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow without a generic parent correlation id", () => {
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
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
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
          correlationId: `some-correlation-id`
        }
      });
    });
  });

  Scenario("Trigger a flow by returning a trigger message from handler", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-other-name",
            sequence: [route(".perform.one", trigger)]
          },
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)]
          }
        ]
      });
    });
    let flowMessages;
    let secondFlowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-other-name.#");
      secondFlowMessages = crd.subscribe("event.some-name.#");
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-other-name", source);
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-other-name.processed");
      msg.should.eql({
        type: "event",
        id: msg.id,
        data: [
          {
            type: "trigger",
            id: "event.some-name",
            occurredAt: msg.data[0].occurredAt,
            key: "event.some-other-name.perform.one"
          }
        ],
        source,
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
    And("the other flow should triggered and be completed", () => {
      secondFlowMessages.length.should.eql(2);
      const {msg, key} = secondFlowMessages.pop();
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
