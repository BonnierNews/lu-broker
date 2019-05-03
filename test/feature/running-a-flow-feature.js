"use strict";

const {start} = require("../../");
const queueHelper = require("../helpers/queue-helper");

async function trigger(message) {
  await queueHelper.publishMessage(message.source.triggerKey, message);
  return message;
}

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
  Scenario("Trigger a flow with one lambda from a known trigger key", () => {
    before(() => {
      queueHelper.resetMock();
      const lambdasMap = {
        "event.some-name.one": handler,
        "sequence.order.trigger": trigger
      };
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "order",
            sequence: [".trigger"]
          },
          {
            namespace: "event",
            name: "some-name",
            sequence: [".one"]
          }
        ],
        lambdas: lambdasMap
      });
    });
    let messages;
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      messages = await queueHelper.publishAndConsumeReply(
        "sequence.order.trigger",
        {
          type: "foo",
          meta: {correlationId: "some-correlation-id"},
          data: [],
          source: {
            triggerKey: "event.some-name.one",
            type: "order"
          }
        },
        "sequence.order.processed"
      );
    });

    Then("the trigger lambda should be processed, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg, key} = messages.pop();
      key.should.eql("sequence.order.processed");
      msg.should.eql({
        type: "foo",
        source: {
          type: "order",
          triggerKey: "event.some-name.one"
        },
        data: [],
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      msg.should.eql({
        type: "foo",
        data: [
          {
            type: "i-was-here",
            id: "my-guid",
            key: "event.some-name.one"
          }
        ],
        source: {
          type: "order",
          triggerKey: "event.some-name.one"
        },
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
        "sequence.the-coolest-event-ever.trigger": trigger,
        "event.the-coolest-event-ever.one": one,
        "event.the-coolest-event-ever.two": two,
        "event.the-coolest-event-ever.three": three
      };
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "the-coolest-event-ever",
            sequence: [".trigger"]
          },
          {
            namespace: "event",
            name: "the-coolest-event-ever",
            sequence: [".one", ".two", ".three"]
          }
        ],
        lambdas: lambdasMap
      });
    });
    let messages;
    let flowMessages;

    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });

    When("we publish an order on a trigger key", async () => {
      messages = await queueHelper.publishAndConsumeReply(
        "sequence.the-coolest-event-ever.trigger",
        {
          type: "foo",
          meta: {correlationId: "some-correlation-id"},
          data: [],
          source: {
            type: "order",
            triggerKey: "event.the-coolest-event-ever.one"
          }
        },
        "sequence.the-coolest-event-ever.processed"
      );
    });

    Then("the trigger lambda should be processed, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg, key} = messages.pop();
      key.should.eql("sequence.the-coolest-event-ever.processed");
      msg.should.eql({
        type: "foo",
        source: {
          type: "order",
          triggerKey: "event.the-coolest-event-ever.one"
        },
        data: [],
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    And("the flow should be completed", () => {
      flowMessages.length.should.eql(4);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.the-coolest-event-ever.processed");
      msg.should.eql({
        type: "foo",
        data: [
          {
            type: "1-was-here",
            id: "my-guid-1",
            key: "event.the-coolest-event-ever.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            key: "event.the-coolest-event-ever.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            key: "event.the-coolest-event-ever.three"
          }
        ],
        source: {
          type: "order",
          triggerKey: "event.the-coolest-event-ever.one"
        },
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario.skip("Trigger a lambda function from a known key", () => {
    let messages;
    Given("we are listening for messages", () => {});
    When("publishing a message on a known key", async () => {
      messages = await queueHelper.publishAndConsumeReply("event.some-name.one", {
        type: "foo",
        data: [],
        meta: {correlationId: "some-correlation-id"}
      });
    });
    Then("the lambda should be triggered, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg} = messages.pop();
      msg.should.eql({
        type: "foo",
        data: [
          {
            type: "i-was-here",
            id: "my-guid",
            key: "event.some-name.one"
          }
        ],
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });
});
