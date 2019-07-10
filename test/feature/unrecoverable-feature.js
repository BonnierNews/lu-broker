"use strict";

const {start, route} = require("../..");
const {crd, reject} = require("../helpers/queue-helper");
const config = require("exp-config");

function rejectHandler(message, context) {
  const {unrecoverableUnless} = context;
  unrecoverableUnless(undefined, "needs to be handled manually!");
}

Feature("Reject message as unrecoverable", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };

  Scenario("Unrecoverable message without a handler in a flow", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", rejectHandler)]
          }
        ]
      });
    });
    let rejectedMessages;

    Given("we are listening for messages on the event namespace", () => {
      rejectedMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    Then("the messages should be rejected", () => {
      rejectedMessages.length.should.eql(1);
      rejectedMessages[0].key.should.eql("event.some-name.perform.one");
    });

    And("the messages should be acked and be the same as the rejected message", () => {
      crd.ackedMessages[0].should.eql(rejectedMessages[0].msg);
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(1);
      reject.nackedMessages[0].should.eql(rejectedMessages[0].msg);
    });

    And("the rejected message should not longer have a reject key", () => {
      rejectedMessages[0].meta.properties.should.not.have.property("type");
    });

    And("the rejected message should have x-death set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property("x-death");
    });
    And("the rejected message should have the expected x-death", () => {
      const [xDeath] = rejectedMessages[0].meta.properties.headers["x-death"];
      xDeath.should.eql({
        count: 1,
        exchange: "CRDExchangeTest",
        queue: "lu-broker-lambdas-test",
        reason: "rejected",
        "routing-keys": ["event.some-name.perform.one"],
        time: xDeath.time
      });
    });
    And("the rejected message should have x-routing-key set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property("x-routing-key", "event.some-name.perform.one");
    });
    And("the rejected message should have correct routingKey", () => {
      rejectedMessages[0].meta.fields.routingKey.should.eql("event.some-name.perform.one");
    });
  });

  Scenario("Unrecoverable message with a handler in a flow", () => {
    const unrecoverable = [];
    function handleUnrecoverable(error, message, context) {
      unrecoverable.push({error, message, routingKey: context.routingKey});
    }

    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", rejectHandler)],
            unrecoverable: [route("*", handleUnrecoverable)]
          }
        ]
      });
    });
    Given("we have a unrecoverable handler", () => {});

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
    });

    Then("the messages should be unrecoverable", () => {
      unrecoverable.length.should.eql(1);
      unrecoverable[0].routingKey.should.eql("event.some-name.perform.one");
    });

    And("the messages should be acked and be the same as the rejected message", () => {
      crd.ackedMessages[0].should.eql(unrecoverable[0].message);
    });

    And("the error should be passed to the handler", () => {
      unrecoverable[0].error.message.should.eql("needs to be handled manually!");
    });
  });

  Scenario("Unrecoverable message with a rejection in a handler", () => {
    const unrecoverable = [];
    function handleUnrecoverable(error, message, context) {
      const {rejectIf} = context;
      unrecoverable.push({error, message, routingKey: context.routingKey});
      rejectIf(true, "too hot to handle");
    }

    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", rejectHandler)],
            unrecoverable: [route("*", handleUnrecoverable)]
          }
        ]
      });
    });
    let rejectedMessages;
    Given("we are listening for messages on the event namespace", () => {
      rejectedMessages = reject.subscribe("#");
    });

    When("we publish an unrecoverabel order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      unrecoverable.length.should.eql(1);
      unrecoverable[0].routingKey.should.eql("event.some-name.perform.one");
    });

    And("the messages should be acked and be the same as the rejected message", () => {
      rejectedMessages[0].msg.should.eql(unrecoverable[0].message);
    });

    And("the rejected message should have x-routing-key set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property("x-routing-key", "event.some-name.perform.one");
    });
    And("the rejected message should have correct routingKey", () => {
      rejectedMessages[0].meta.fields.routingKey.should.eql("event.some-name.perform.one");
    });
  });

  Scenario("Unrecoverable message with a retry handler in a flow", () => {
    const unrecoverable = [];
    function handleUnrecoverable(error, message, context) {
      const {retryIf} = context;
      unrecoverable.push({error, message, routingKey: context.routingKey});
      retryIf(true, "please try again later!");
    }

    before(() => {
      config.silenceTestErrors = true;
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", rejectHandler)],
            unrecoverable: [route("*", handleUnrecoverable)]
          }
        ]
      });
    });
    after(() => {
      config.silenceTestErrors = false;
    });

    When("we publish an unrecoverabel order on a trigger key", async () => {
      await crd.publishMessage("trigger.event.some-name", source);
      unrecoverable.length.should.eql(1);
      unrecoverable[0].routingKey.should.eql("event.some-name.perform.one");
    });

    And("the messages should be nacked(false) and be the same as the rejected message", () => {
      crd.nackedMessages[0].should.eql(unrecoverable[0].message);
    });
  });
});
