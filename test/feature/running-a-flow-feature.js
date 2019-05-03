"use strict";

const {start} = require("../../");
const queueHelper = require("../helpers/queue-helper");
const lambdasMap = {
  "event.some-name.one": handler,
  "sequence.order.trigger": trigger
};

async function trigger(message) {
  await queueHelper.publishMessage("event.some-name.one", message);
  return message;
}

function handler(message) {
  message.data.push({type: "i-was-here", id: "my-guid"});
  return message;
}

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

Feature("Lamda functions", () => {
  Scenario("Trigger a flow from a known trigger key", () => {
    let messages;
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = queueHelper.subscribe("event.#");
    });
    When("we publish an order on a trigger key", async () => {
      messages = await queueHelper.publishAndConsumeReply("sequence.order.trigger", {
        type: "foo",
        meta: {correlationId: "some-correlation-id"},
        source: {
          type: "order"
        }
      });
    });
    Then("the trigger lambda should be triggered, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg} = messages.pop();
      msg.should.eql({
        type: "foo",
        source: {
          type: "order"
        },
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
    And("the flow should be completed", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = messages.pop();
      key.should.eql("bax");
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
          type: "order"
        },
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });
  });

  Scenario("Trigger a lambda function from a known key", () => {
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
