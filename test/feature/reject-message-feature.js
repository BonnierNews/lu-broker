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

  Scenario("Rejecting a trigger message", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        triggers: {
          "trigger.some-name": () => {
            throw Error("got that wrong");
          }
        },
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
      await crd.publishMessage("trigger.some-name", source);
    });

    Then("the trigger message should be rejected", () => {
      rejectedMessages.length.should.eql(1);
      rejectedMessages[0].key.should.eql("trigger.some-name");
    });

    And("the message should be acked and be the same as the rejected message", () => {
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
        queue: "lu-broker-triggers-test",
        reason: "rejected",
        "routing-keys": ["trigger.some-name"],
        time: xDeath.time
      });
    });
    And("the rejected message should have x-routing-key set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property("x-routing-key", "trigger.some-name");
    });
    And("the rejected message should have correct routingKey", () => {
      rejectedMessages[0].meta.fields.routingKey.should.eql("trigger.some-name");
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

  Scenario("Rejecting invalid messages", () => {
    const passThru = (msg) => msg;
    const valid = () => Object({type: "other", id: "guid-2"});
    const eventer = () => Object({type: "event", id: "guid"});
    const invalid = () => Object({baz: "event", foo: "guid"});

    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "event",
            name: "failer",
            sequence: [route(".perform.valid", valid), route(".perform.one", passThru)]
          },
          {
            namespace: "event",
            name: "failer2",
            sequence: [route(".perform.one", eventer)]
          },
          {
            namespace: "event",
            name: "failer3",
            sequence: [route(".perform.one", invalid)]
          }
        ]
      });
    });
    let rejectedMessages;

    Given("we are listening for messages on the event namespace", () => {
      rejectedMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key with an invalid step", async () => {
      await crd.publishMessage("trigger.event.failer", source);
    });

    Then("the messages should be rejected", () => {
      rejectedMessages.length.should.eql(1);
      rejectedMessages[0].key.should.eql("event.failer.perform.one");
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(1);
      reject.nackedMessages[0].should.eql(rejectedMessages[0].msg);
    });

    And("the message should contain an error", () => {
      rejectedMessages[0].msg.errors[0].title.should.match(/Invalid response on routing key: event.failer.perform.one/);
    });

    When("we publish an order on another trigger key with an invalid step", async () => {
      await crd.publishMessage("trigger.event.failer2", source);
    });

    Then("the messages should be rejected", () => {
      rejectedMessages.length.should.eql(2);
      rejectedMessages[1].key.should.eql("event.failer2.perform.one");
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(2);
      reject.nackedMessages[1].should.eql(rejectedMessages[1].msg);
    });

    And("the message should contain an error", () => {
      rejectedMessages[1].msg.errors[0].title.should.match(
        /Invalid response on routing key: event.failer2.perform.one/
      );
    });

    When("we publish an order on yet another trigger key with a step that has invalid return message", async () => {
      await crd.publishMessage("trigger.event.failer3", source);
    });

    Then("the messages should be rejected", () => {
      rejectedMessages.length.should.eql(3);
      rejectedMessages[2].key.should.eql("event.failer3.perform.one");
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(3);
      reject.nackedMessages[2].should.eql(rejectedMessages[2].msg);
    });

    And("the message should contain an error", () => {
      rejectedMessages[2].msg.errors[0].title.should.match(
        /Invalid response on routing key: event.failer3.perform.one response: {"baz":"event","foo":"guid"}/
      );
    });
  });
});
