"use strict";

const {start} = require("../..");
const queueHelper = require("../helpers/queue-helper");

async function trigger(message) {
  const [namespace, event] = message.source.triggerKey.split(".");
  await queueHelper.publishWithMeta(message.source.triggerKey, message, {
    headers: {
      eventName: `${namespace}.${event}`
    }
  });
  return message;
}

// alternate
// function triggerEvent(message) {
//   return triggerMessage(message, "eventName", context.debugMeta);
// }

// function triggerMessage(message, eventName) {
//   return {
//     type: "trigger",
//     id: eventName,
//     source: message.source,
//     meta: message.meta
//   };
// }

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

  Scenario("Trigger a flow which has lambdas from a another flow", () => {
    before(() => {
      queueHelper.resetMock();
      const lambdasMap = {
        "sequence.1st.trigger": trigger,
        "event.1st.one": one,
        "event.2nd.two": two,
        "event.1st.three": three
      };
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "1st",
            sequence: [".trigger"]
          },
          {
            namespace: "event",
            name: "1st",
            sequence: [".one", "event.2nd.two", ".three"]
          },
          {
            namespace: "event",
            name: "2nd",
            sequence: [".two"]
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
        "sequence.1st.trigger",
        {
          type: "foo",
          meta: {correlationId: "some-correlation-id"},
          data: [],
          source: {
            type: "order",
            triggerKey: "event.1st.one"
          }
        },
        "sequence.1st.processed"
      );
    });

    Then("the trigger lambda should be processed, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg, key} = messages.pop();
      key.should.eql("sequence.1st.processed");
      msg.should.eql({
        type: "foo",
        source: {
          type: "order",
          triggerKey: "event.1st.one"
        },
        data: [],
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    And("the flow should be completed", () => {
      flowMessages
        .map(({key}) => key)
        .should.eql(["event.1st.one", "event.2nd.two", "event.1st.three", "event.1st.processed"]);

      const {msg, key} = flowMessages.pop();
      key.should.eql("event.1st.processed");
      msg.should.eql({
        type: "foo",
        data: [
          {
            type: "1-was-here",
            id: "my-guid-1",
            key: "event.1st.one"
          },
          {
            type: "2-was-here",
            id: "my-guid-2",
            key: "event.2nd.two"
          },
          {
            type: "3-was-here",
            id: "my-guid-3",
            key: "event.1st.three"
          }
        ],
        source: {
          type: "order",
          triggerKey: "event.1st.one"
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
