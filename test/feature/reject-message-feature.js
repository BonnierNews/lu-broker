"use strict";

const {start, route} = require("../..");
const {crd, reject} = require("../helpers/queue-helper");

function rejectHandler(message, context) {
  const {rejectUnless} = context;
  rejectUnless(undefined, "dying hard!");
}

Feature("Reject message", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "some-correlation-id"},
    attributes: {baz: true}
  };
  Scenario("Rejecting a message in a flow", () => {
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

  Scenario("Rejecting a message in a flow preserving headers", () => {
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
      await crd.publishWithMeta(
        "event.some-name.perform.one",
        {
          type: "event",
          data: [],
          meta: {}
        },
        {
          headers: {
            ["x-count"]: 3
          },
          correlationId: "some-correlation-id",
          replyTo: "event.some-name.perform.one.processed"
        }
      );
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
    And("the rejected message should have x-count set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property("x-count", 3);
    });
    And("the rejected message should have correlation id set", () => {
      rejectedMessages[0].meta.properties.should.have.property("correlationId", "some-correlation-id");
    });
    And("the rejected message should have replyTo id set", () => {
      rejectedMessages[0].meta.properties.should.have.property("replyTo", "event.some-name.perform.one.processed");
    });
  });
});
