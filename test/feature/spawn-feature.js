"use strict";

const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");
const brokerServer = require("../helpers/broker-job-server");

const source = {
  type: "order",
  id: "some-id",
  meta: {correlationId: "some-correlation-id"},
  attributes: {baz: true}
};

const source2 = {...source, id: "some-other-id"};

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

function triggerMultiple() {
  return {
    type: "trigger",
    id: "event.some-sub-name",
    source: [source, source2],
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
  afterEachScenario(stop);
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
    let flowMessages, donePromise, triggerMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
      donePromise = new Promise((resolve) => crd.subscribe("event.some-name.processed", resolve));
    });

    When("we publish an order on the other events a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      triggerMessages = crd.subscribe("trigger.#");
    });

    Then("we should get a trigger message", () => {
      triggerMessages.should.have.length(1);
      const {key, msg} = triggerMessages[0];
      key.should.eql("trigger.event.some-sub-name");
      msg.should.eql({
        ...source,
        meta: {
          correlationId: "some-correlation-id:0",
          notifyProcessed: "event.some-name.perform.one:some-correlation-id",
          parentCorrelationId: "some-correlation-id"
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
      brokerServer.start();

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
            namespace: "event",
            name: "some-sub-name",
            sequence: [route(".perform.one", addWithTry(1, 5))]
          }
        ]
      });
    });

    after(() => {
      brokerServer.reset();
    });
    let flowMessages, subFlowMessages, donePromise, triggerMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.some-name.#");
      subFlowMessages = crd.subscribe("event.some-sub-name.#");
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
      const {key, msg} = triggerMessages[1];
      key.should.eql("trigger.event.some-sub-name");
      msg.should.eql(source2);
    });

    And("the parent flow should be completed", async () => {
      await donePromise;
      flowMessages.length.should.eql(4);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.processed");
      msg.data
        .map(({type, id}) => ({type, id}))
        .should.eql([
          {type: "baz", id: "my-guid-0"},
          {type: "trigger", id: "event.some-sub-name"},
          {type: "trigger", id: "event.some-sub-name"},
          {type: "baz", id: "my-guid-2"}
        ]);
    });

    And("the 2 child flows should be completed", async () => {
      await donePromise;
      subFlowMessages.length.should.eql(4);
      subFlowMessages
        .filter(({key}) => key === "event.some-sub-name.processed")
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
