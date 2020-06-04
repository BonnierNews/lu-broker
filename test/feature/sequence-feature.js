"use strict";

const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

function one() {
  return {type: "1-was-here", id: "my-guid-1"};
}

function two() {
  return {type: "2-was-here", id: "my-guid-2"};
}

function three() {
  return {type: "3-was-here", id: "my-guid-3"};
}

function zero() {
  return {type: "zero-was-here", id: 0};
}

function multi() {
  return [two(), three()];
}

function empty() {
  return [];
}

function nuller() {
  return;
}

Feature("Lamda functions", () => {
  afterEachScenario(stop);
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };
  Scenario("Trigger a flow with one lambda from a known trigger key", () => {
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
          correlationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow with lambdas that returns arrays from a known trigger key", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "multi-test",
            sequence: [
              route(".perform.one", handler),
              route(".perform.empty", empty),
              route(".perform.null", nuller),
              route(".perform.multi", multi),
              route(".perform.zero", zero)
            ]
          }
        ]
      });
    });
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.multi-test", source);
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(6);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.multi-test.processed");
      const {data} = msg;
      data.should.eql([
        {
          type: "i-was-here",
          id: "my-guid",
          occurredAt: msg.data[0].occurredAt,
          key: "event.multi-test.perform.one"
        },
        {
          type: "2-was-here",
          id: "my-guid-2",
          occurredAt: msg.data[1].occurredAt,
          key: "event.multi-test.perform.multi"
        },
        {
          type: "3-was-here",
          id: "my-guid-3",
          occurredAt: msg.data[1].occurredAt,
          key: "event.multi-test.perform.multi"
        },
        {
          type: "zero-was-here",
          id: 0,
          occurredAt: msg.data[3].occurredAt,
          key: "event.multi-test.perform.zero"
        }
      ]);
    });
  });

  Scenario("Trigger a flow with three lambdas from a known trigger key", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "the-coolest-event-ever",
            sequence: [route(".perform.one", one), route(".perform.two", two), route(".perform.three", three)]
          }
        ]
      });
    });
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.the-coolest-event-ever", source);
    });

    Then("the flow should be completed", () => {
      flowMessages.length.should.eql(4);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.the-coolest-event-ever.processed");
      msg.should.eql({
        type: "event",
        id: msg.id,
        data: [
          {
            type: "1-was-here",
            id: "my-guid-1",
            occurredAt: msg.data[0].occurredAt,
            key: "event.the-coolest-event-ever.perform.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            occurredAt: msg.data[1].occurredAt,
            key: "event.the-coolest-event-ever.perform.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            occurredAt: msg.data[2].occurredAt,
            key: "event.the-coolest-event-ever.perform.three"
          }
        ],
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow which has lambdas from a another flow", () => {
    before(() => {
      crd.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "first",
            sequence: [route(".perform.one", one), route("event.second.perform.two"), route(".perform.three", three)]
          },
          {
            namespace: "event",
            name: "second",
            sequence: [route(".perform.two", two)]
          }
        ]
      });
    });
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.first", source);
    });

    Then("the flow should be completed", () => {
      flowMessages
        .map(({key}) => key)
        .should.eql([
          "event.first.perform.one",
          "event.first.event.second.perform.two",
          "event.first.perform.three",
          "event.first.processed"
        ]);

      const {msg, key} = flowMessages.pop();
      key.should.eql("event.first.processed");
      msg.should.eql({
        type: "event",
        id: msg.id,
        data: [
          {
            type: "1-was-here",
            id: "my-guid-1",
            occurredAt: msg.data[0].occurredAt,
            key: "event.first.perform.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            occurredAt: msg.data[1].occurredAt,
            key: "event.first.event.second.perform.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            occurredAt: msg.data[2].occurredAt,
            key: "event.first.perform.three"
          }
        ],
        source: {id: source.id, type: source.type, attributes: source.attributes, meta: source.meta},
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });
});
