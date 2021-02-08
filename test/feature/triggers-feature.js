"use strict";

const {start, route, stop} = require("../..");
const {crd, reject} = require("../helpers/queue-helper");
const {waitForMessage, reset} = require("../helpers/rabbit-helper");
const jobStorage = require("../../lib/job-storage");

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

  function triggerAsync() {
    return new Promise((resolve) => {
      return resolve({
        type: "trigger",
        id: "event.some-name",
        source,
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  }

  beforeEachScenario(async () => {
    jobStorage.reset();
    await reset();
  });

  Scenario("Trigger a flow with a trigger message", () => {
    before(() => {
      //crd.resetMock();
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
    let flowMessages, donePromise;
    Given("we are listening for messages on the event namespace", () => {
      donePromise = waitForMessage("event.some-name.processed");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", source);
    });

    And("the flow should be completed", async () => {
      flowMessages = await donePromise;
      flowMessages.length.should.eql(1);
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

  Scenario("Trigger a flow with a trigger message, async trigger", () => {
    before(() => {
      start({
        triggers: {
          "trigger.some-generic-name": triggerAsync
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
    let flowMessages, donePromise;
    Given("we are listening for messages on the event namespace", () => {
      donePromise = waitForMessage("event.some-name.processed");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", source);
    });

    And("the flow should be completed", async () => {
      flowMessages = await donePromise;
      flowMessages.length.should.eql(1);
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
    let flowMessages, donePromise;
    Given("we are listening for messages on the event namespace", () => {
      donePromise = waitForMessage("event.#", 4);
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.some-generic-name", {...source, numToTrigger: 2});
    });

    And("the flow should be completed", async () => {
      flowMessages = await donePromise;
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
      await crd.publishWithMeta("trigger.event.some-name", source, {
        headers: {"x-notify-processed": true}
      });
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: `some-correlation-id`
        }
      });
    });
  });

  Scenario("Trigger a flow without a generic parent correlation id but parent correlation id in header", () => {
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
      await crd.publishWithMeta("trigger.event.some-name", source, {
        headers: {"x-parent-correlation-id": "this-is-parent"}
      });
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: `some-correlation-id`,
          parentCorrelationId: "this-is-parent"
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
    let triggerMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-other-name.#");
      secondFlowMessages = crd.subscribe("event.some-name.#");
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-other-name", source);
      triggerMessages = crd.subscribe("trigger.#");
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    And("there should be an internal message", () => {
      triggerMessages.length.should.eql(1);
      const {msg, key} = triggerMessages.pop();
      key.should.eql("trigger.event.some-name");
      msg.should.eql({
        ...source
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
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: "some-correlation-id:0",
          notifyProcessed: "event.some-other-name.perform.one:some-correlation-id",
          parentCorrelationId: "some-correlation-id"
        }
      });
    });
  });
});
