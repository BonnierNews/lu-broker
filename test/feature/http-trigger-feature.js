"use strict";
const request = require("../helpers/request-helper");
const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

Feature("Trigger via http", () => {
  const source = {
    type: "order",
    id: "some-id",
    meta: {correlationId: "trigger-via-http-correlation"},
    attributes: {baz: true}
  };
  function trigger() {
    return {
      type: "trigger",
      id: "event.some-name",
      source,
      correlationId: "some-other-trigger-via-http-correlation"
    };
  }

  before(() => {
    crd.resetMock();
    start({
      triggers: {
        "trigger.some-generic-name": trigger
      },
      recipes: [
        {
          namespace: "event",
          name: "some-name",
          sequence: [route(".perform.one", handler)]
        }
      ]
    });
  });
  after(stop);

  Scenario("Trigger a flow with a generic http POST trigger message", () => {
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    let response;
    When("we POST an order via http", async () => {
      response = await request.post("/trigger/some-name", source);
    });

    Then("the response should be a 200 OK", () => {
      response.statusCode.should.eql(200, response.text);
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
        source,
        meta: {
          correlationId: "trigger-via-http-correlation"
        }
      });
    });
  });

  Scenario("Trigger a specific flow with a http POST trigger message", () => {
    let flowMessages;
    Given("we are listening for messages on the event namespace", () => {
      flowMessages = crd.subscribe("event.#");
    });

    let response;
    When("we POST an order via http", async () => {
      response = await request.post("/trigger/some-generic-name", source);
    });

    Then("the response should be a 200 OK", () => {
      response.statusCode.should.eql(200);
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
        source,
        meta: {
          parentCorrelationId: "trigger-via-http-correlation",
          correlationId: "some-other-trigger-via-http-correlation"
        }
      });
    });
  });
});
