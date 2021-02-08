"use strict";

const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");
const {subscribe, reset} = require("../helpers/rabbit-helper");
const jobStorage = require("../../lib/job-storage");

const source = {
  type: "order",
  id: "some-id",
  meta: {correlationId: "some-order-correlation-id"},
  attributes: {baz: true}
};

const source2 = {...source, meta: {correlationId: "some-other-order-correlation-id"}, id: "some-other-id"};

function trigger() {
  return {
    type: "trigger",
    id: "sub-sequence.some-sub-name",
    source,
    meta: {
      correlationId: "some-correlation-id"
    }
  };
}

function triggerMultiple() {
  return {
    type: "trigger",
    id: "sub-sequence.some-sub-name",
    source: [source, source2],
    meta: {
      correlationId: "some-correlation-id"
    }
  };
}

function subTrigger() {
  return {
    type: "trigger",
    id: "sub-sequence.grand-child",
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
  afterEachScenario(async () => {
    await stop();
    jobStorage.reset();
    await reset();
  });
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
            namespace: "sub-sequence",
            name: "some-sub-name",
            sequence: [route(".perform.one", addWithDelay(1, 5))]
          }
        ]
      });
    });

    let subscription, triggerSubscription;
    Given("we are listening for messages on the event namespace", async () => {
      subscription = await subscribe("event.some-name.processed");
    });

    When("we publish an order on the other events a trigger key", async () => {
      triggerSubscription = await subscribe("trigger.sub-sequence.#");
      await crd.publishMessage("trigger.event.some-name", source);
    });

    Then("we should get a trigger message", async () => {
      const [{key, msg}] = await triggerSubscription.waitForMessages();
      key.should.eql("trigger.sub-sequence.some-sub-name");
      msg.should.eql({
        ...source
      });
    });

    And("the flow should be completed", async () => {
      const [{msg, key}] = await subscription.waitForMessages();
      key.should.eql("event.some-name.processed");
      msg.data
        .map(({type, id}) => ({type, id}))
        .should.eql([
          {type: "baz", id: "my-guid-0"},
          {type: "trigger", id: "sub-sequence.some-sub-name"},
          {type: "baz", id: "my-guid-2"}
        ]);
    });

    And("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 1, 2]);
    });
  });

  Scenario("Trigger a flow by returning a list of sources in a trigger message from handler", () => {
    const result = [];
    let tries = 0;
    function addWithDelay(i, delay = 0) {
      return async () => {
        await sleep(delay);
        result.push(i);
        return {type: "baz", id: `my-guid-${i}`};
      };
    }
    function addWithTry(i, delay = 0) {
      return async () => {
        tries = tries + 10;
        const newDelay = delay + tries;
        await sleep(newDelay);
        result.push(i);
        return {type: "baz", id: `my-try-${newDelay}`};
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
              route(".perform.one", triggerMultiple),
              route(".perform.two", addWithDelay(2, 1))
            ]
          },
          {
            namespace: "sub-sequence",
            name: "some-sub-name",
            sequence: [route(".perform.one", addWithTry(1, 5))]
          }
        ]
      });
    });

    let childSubscription, subscription, triggerSubscription, triggerMessages;
    Given("we are listening for messages on the event namespace", async () => {
      subscription = await subscribe("event.some-name.processed");
      childSubscription = await subscribe("sub-sequence.some-sub-name.#");
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      triggerSubscription = await subscribe("trigger.#", 2);
      triggerMessages = await triggerSubscription.waitForMessages();
    });

    Then("we should get 2 trigger messages", () => {
      triggerMessages.should.have.length(2);
    });

    And("the last one should be the last source message", () => {
      triggerMessages
        .map(({msg}) => msg)
        .should.eql([
          {
            ...source
          },
          {
            ...source2
          }
        ]);
    });

    And("the trigger messages should carry parent correlation ids and such using headers", () => {
      triggerMessages[0].meta.properties.correlationId.should.eql(`${source.meta.correlationId}:0`);
      triggerMessages[0].meta.properties.headers["x-parent-correlation-id"].should.eql(source.meta.correlationId);
      triggerMessages[0].meta.properties.headers["x-notify-processed"].should.eql(
        `event.some-name.perform.one:${source.meta.correlationId}`
      );
      triggerMessages[1].meta.properties.correlationId.should.eql(`${source.meta.correlationId}:1`);
      triggerMessages[1].meta.properties.headers["x-parent-correlation-id"].should.eql(source.meta.correlationId);
      triggerMessages[1].meta.properties.headers["x-notify-processed"].should.eql(
        `event.some-name.perform.one:${source.meta.correlationId}`
      );
    });

    And("the parent flow should be completed", async () => {
      const [{msg, key}] = await subscription.waitForMessages();
      key.should.eql("event.some-name.processed");
      msg.data
        .map(({type, id, times}) => ({type, id, times}))
        .should.eql([
          {type: "baz", id: "my-guid-0", times: undefined},
          {type: "trigger", id: "sub-sequence.some-sub-name", times: 2},
          {type: "baz", id: "my-guid-2", times: undefined}
        ]);
    });

    And("the 2 child flows should be completed", async () => {
      const childMessages = await childSubscription.waitForMessages();
      childMessages.length.should.eql(4);
      childMessages
        .filter(({key}) => key === "sub-sequence.some-sub-name.processed")
        .map(({msg}) => msg.data)
        .forEach((data, idx) => {
          data.map(({type, id}) => ({type, id})).should.eql([{type: "baz", id: `my-try-${idx * 10 + 15}`}]); // not ok!
        });
    });

    And("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 1, 1, 2]);
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
            namespace: "sub-sequence",
            name: "some-sub-name",
            sequence: [route(".perform.one", subTrigger), route(".perform.two", addWithDelay(3, 1))]
          },
          {
            namespace: "sub-sequence",
            name: "grand-child",
            sequence: [route(".perform.one", addWithDelay(4, 2))]
          }
        ]
      });
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
          {type: "trigger", id: "sub-sequence.some-sub-name"},
          {type: "baz", id: "my-guid-2"}
        ]);
    });

    Then("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 4, 3, 2]);
    });
  });

  Scenario("One child is unrecoverable", () => {
    const unrecoverable = [];
    function handleUnrecoverable(error, message, context) {
      unrecoverable.push({error, message, routingKey: context.routingKey});
      return {type: "some-type", id: "some-id"};
    }
    const result = [];
    let tries = 0;
    function addWithDelay(i, delay = 0) {
      return async () => {
        await sleep(delay);
        result.push(i);
        return {type: "baz", id: `my-guid-${i}`};
      };
    }
    function addWithTry(i, delay = 0) {
      return async (message, {unrecoverableIf}) => {
        unrecoverableIf(message.meta.correlationId === "some-order-correlation-id:1", "this is a bad order");
        tries = tries + 10;
        const newDelay = delay + tries;
        await sleep(newDelay);
        result.push(i);
        return {type: "baz", id: `my-try-${newDelay}`};
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
              route(".perform.one", triggerMultiple),
              route(".perform.two", addWithDelay(2, 1))
            ]
          },
          {
            namespace: "sub-sequence",
            name: "some-sub-name",
            sequence: [route(".perform.one", addWithTry(1, 5))],
            unrecoverable: [route("*", handleUnrecoverable)]
          }
        ]
      });
    });

    let flowMessages, subFlowMessages, donePromise, triggerMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
      subFlowMessages = crd.subscribe("sub-sequence.some-sub-name.#");
      donePromise = new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      triggerMessages = crd.subscribe("trigger.#");
    });

    Then("we should get 2 trigger messages", () => {
      triggerMessages.should.have.length(2);
    });

    And("the last one should be the last source message", () => {
      triggerMessages
        .map(({msg}) => msg)
        .should.eql([
          {
            ...source
          },
          {
            ...source2
          }
        ]);
    });

    And("the trigger messages should carry parent correlation ids and such using headers", () => {
      triggerMessages[0].meta.properties.correlationId.should.eql(`${source.meta.correlationId}:0`);
      triggerMessages[0].meta.properties.headers["x-parent-correlation-id"].should.eql(source.meta.correlationId);
      triggerMessages[0].meta.properties.headers["x-notify-processed"].should.eql(
        `event.some-name.perform.one:${source.meta.correlationId}`
      );
      triggerMessages[1].meta.properties.correlationId.should.eql(`${source.meta.correlationId}:1`);
      triggerMessages[1].meta.properties.headers["x-parent-correlation-id"].should.eql(source.meta.correlationId);
      triggerMessages[1].meta.properties.headers["x-notify-processed"].should.eql(
        `event.some-name.perform.one:${source.meta.correlationId}`
      );
    });

    And("the parent flow should be completed", async () => {
      await donePromise;
      flowMessages.length.should.eql(4);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      msg.data
        .map(({type, id, times}) => ({type, id, times}))
        .should.eql([
          {type: "baz", id: "my-guid-0", times: undefined},
          {type: "trigger", id: "sub-sequence.some-sub-name", times: 2},
          {type: "baz", id: "my-guid-2", times: undefined}
        ]);
    });

    And("the 2 child flows should be completed", async () => {
      await donePromise;
      subFlowMessages.length.should.eql(4);
      subFlowMessages
        .filter(({key}) => key === "sub-sequence.some-sub-name.processed")
        .map(({msg}) => msg.data)
        .forEach((data, idx) => {
          data.map(({type, id}) => ({type, id})).should.eql([{type: "baz", id: `my-try-${idx * 10 + 15}`}]); // not ok!
        });
    });

    And("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, 1, 2]);
    });
    And("one should have been handled by unrecoverable handler", () => {
      unrecoverable.length.should.eql(1);
    });
  });

  Scenario.only("Trigger a flow and delay execution of children", () => {
    const result = [];
    function addWithDelay(i, delay = 0) {
      return async () => {
        await sleep(delay);
        result.push(i);
        return {type: "baz", id: `my-guid-${i}`};
      };
    }
    let concurrent = 0;
    function brittleFn(input) {
      const timeout = 2;
      if (concurrent++ > 0) {
        throw new Error("Too many requests");
      }
      setTimeout(() => {
        result.push(input.source.id);
        concurrent--;
      }, timeout);
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
              route(".perform.one", triggerMultiple),
              route(".perform.two", addWithDelay(2, 1))
            ]
          },
          {
            namespace: "sub-sequence",
            name: "some-sub-name",
            sequence: [route(".perform.one", brittleFn)]
          }
        ]
      });
    });

    let subFlowMessages, subscription;
    Given("we are listening for messages on the event namespace", async () => {
      subscription = await subscribe("sub-sequence.some-sub-name.#", 4);
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    And("the 2 child flows should be completed", async () => {
      await subscription.waitForMessages();
      subscription.messages.length.should.eql(4);
      subFlowMessages.filter(({key}) => key === "sub-sequence.some-sub-name.processed").length.should.eql(2);
    });

    And("the handlers should have been triggered in correct order", () => {
      result.should.eql([0, "some-id", "some-other-id", 2]);
    });
  });
});
