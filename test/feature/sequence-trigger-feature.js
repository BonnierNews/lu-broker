"use strict";

const {start} = require("../..");
const queueHelper = require("../helpers/queue-helper");
function handler(message) {
  message.data.push({type: "i-was-here", id: "my-guid"});
  return message;
}

function one(message) {
  message.data.push({type: "1-was-here", id: "my-guid-1"});
  return message;
}

function two(message) {
  message.data.push({type: "2-was-here", id: "my-guid-2"});
  return message;
}

function three(message) {
  message.data.push({type: "3-was-here", id: "my-guid-3"});
  return message;
}

Feature("Lamda functions", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };
  Scenario("Trigger a flow with one lambda from a known trigger key", () => {
    before(() => {
      queueHelper.resetMock();
      const lambdasMap = {
        "event.some-name.perform.one": handler
      };
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [".perform.one"]
          }
        ],
        lambdas: lambdasMap
      });
    });
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await queueHelper.publishMessage("trigger.event.some-name", source);
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

  Scenario("Trigger a flow with three lambdas from a known trigger key", () => {
    before(() => {
      queueHelper.resetMock();
      const lambdasMap = {
        "event.the-coolest-event-ever.perform.one": one,
        "event.the-coolest-event-ever.perform.two": two,
        "event.the-coolest-event-ever.perform.three": three
      };
      start({
        recipes: [
          {
            namespace: "event",
            name: "the-coolest-event-ever",
            sequence: [".perform.one", ".perform.two", ".perform.three"]
          }
        ],
        lambdas: lambdasMap
      });
    });
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await queueHelper.publishMessage("trigger.event.the-coolest-event-ever", source);
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
            key: "event.the-coolest-event-ever.perform.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            key: "event.the-coolest-event-ever.perform.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            key: "event.the-coolest-event-ever.perform.three"
          }
        ],
        source,
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a flow which has lambdas from a another flow", () => {
    before(() => {
      queueHelper.resetMock();
      const lambdasMap = {
        "event.first.perform.one": one,
        "event.second.perform.two": two,
        "event.first.perform.three": three
      };
      start({
        recipes: [
          {
            namespace: "event",
            name: "first",
            sequence: [".perform.one", "event.second.perform.two", ".perform.three"]
          },
          {
            namespace: "event",
            name: "second",
            sequence: [".perform.two"]
          }
        ],
        lambdas: lambdasMap
      });
    });
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      await queueHelper.publishMessage("trigger.event.first", source);
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
            key: "event.first.perform.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            key: "event.first.event.second.perform.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            key: "event.first.perform.three"
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
