"use strict";

const brokerServer = require("../helpers/broker-job-server");
const {start, route, stop} = require("../..");
const {crd, reject} = require("../helpers/queue-helper");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

Feature("Triggers", () => {
  afterEachScenario(stop);
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

  function triggerNothing() {
    return;
  }

  function triggerWithCorrelationId() {
    return {
      type: "trigger",
      id: "event.some-name",
      source,
      correlationId: "some-other-correlation-id"
    };
  }

  before(() => {
    brokerServer.start();
  });

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
      reject.resetMock();
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
    let rejectMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
      rejectMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", {...source, numToTrigger: 0});
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(0);
    });

    And("nothing should be rejected", () => {
      rejectMessages.length.should.eql(0);
    });
  });

  Scenario("Trigger a flow with a trigger message, spawn no sequences #2", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();

      start({
        triggers: {
          "trigger.some-generic-name": triggerNothing
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
    let rejectMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
      rejectMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", {...source, numToTrigger: 0});
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(0);
    });

    And("nothing should be rejected", () => {
      rejectMessages.length.should.eql(0);
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

  Scenario("Trigger a flow with a sequence generic parent correlation id and notifyProcessed", () => {
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
      await crd.publishMessage("trigger.event.some-name", {...source, meta: {...source.meta, notifyProcessed: true}});
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
        source: {id: source.id, type: source.type, attributes: source.attributes},
        meta: {
          correlationId: `some-correlation-id:${newCorrId}`,
          parentCorrelationId: "some-correlation-id",
          notifyProcessed: true
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
        source: {id: source.id, type: source.type, attributes: source.attributes},
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
        source: {id: source.id, type: source.type, attributes: source.attributes},
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
    let internalMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-other-name.#");
      secondFlowMessages = crd.subscribe("event.some-name.#");
      internalMessages = crd.subscribe("#.internal.#");
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-other-name", source);
      await new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages[1];
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
        source: {id: source.id, type: source.type, attributes: source.attributes},
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    And("there should be an internal message", () => {
      internalMessages.length.should.eql(1);
      const {msg, key} = internalMessages.pop();
      key.should.eql("lu-broker.internal.trigger-message");
      msg.should.eql({
        type: "internal-message",
        id: "event.some-other-name.perform.one:some-correlation-id",
        attributes: {
          trigger: "trigger.event.some-name",
          source,
          responseKey: "event.some-other-name.processed",
          message: flowMessages[flowMessages.length - 1].msg
        },
        meta: {
          correlationId: source.meta.correlationId
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
        source: {id: source.id, type: source.type, attributes: source.attributes},
        meta: {
          correlationId: "some-correlation-id:0",
          notifyProcessed: "event.some-other-name.perform.one:some-correlation-id",
          parentCorrelationId: "some-correlation-id"
        }
      });
    });
  });
});
