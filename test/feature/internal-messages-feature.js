"use strict";

const {start, route, stop} = require("../..");
const {crd} = require("../helpers/queue-helper");
const fakeApi = require("../helpers/fake-api");
const config = require("exp-config");

function handler() {
  return {type: "i-was-here", id: "my-guid"};
}

const storeConfig = config.jobStorage;
Feature("Internal messasges", () => {
  before(() => {
    config.jobStorage = "http";
  });
  after(() => {
    config.jobStorage = storeConfig;
  });

  afterEachScenario(stop);

  Scenario("Responding to a processed message", () => {
    before(() => {
      crd.resetMock();
      fakeApi.reset();
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [route(".perform.one", handler)]
          }
        ]
      });
    });

    let flowMessages;
    Given("we are listening for flow messages", () => {
      flowMessages = crd.subscribe("event.some-name.#");
    });

    And("the broker job server is responding", () => {
      fakeApi.put("/entity/v2/broker-job/some-correlation-id:event.process.one/0").reply(200, {
        attributes: {
          responseKey: "event.some-name.perform.one",
          message: {id: "orig-message", type: "event", meta: {correlationId: "parent-corr"}},
          done: true
        },
        meta: {
          correlationId: "some-correlation-id"
        }
      });
    });

    When("we publish a processed message", async () => {
      await crd.publishMessage("event.some-name.processed", {
        type: "event",
        id: "some-id",
        data: [],
        meta: {correlationId: "some-correlation-id:0", notifyProcessed: "some-correlation-id:event.process.one"}
      });
    });

    Then("we should get a resumed message", () => {
      flowMessages.length.should.eql(2);
      const {msg, key} = flowMessages.pop();
      key.should.eql("event.some-name.perform.one");
      msg.should.eql({
        id: "orig-message",
        type: "event",
        meta: {
          correlationId: "parent-corr"
        }
      });
    });

    And("the job server should have been called", () => {
      fakeApi.pendingMocks().should.eql([]);
    });
  });
});
