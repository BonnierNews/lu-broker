"use strict";

const { crd } = require("../helpers/queue-helper");
const { start, route, stop } = require("../..");

const snooze = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sigHandler() {
  process.emit("test-SIGTERM");
  await snooze(100);
  setTimeout(() => {
    return { type: "i-was-here", id: "my-guid" };
  }, 5000);
}

function handler() {
  return { type: "i-was-here", id: "my-guid" };
}

Feature("Graceful shutdown", () => {
  afterEachScenario(stop);
  Scenario("SIGTERM is received when handler is doing work", () => {
    Given("broker is started", () => {
      start({
        recipes: [
          {
            namespace: "event",
            name: "some-name",
            sequence: [
              route(".perform.one", handler),
              route(".perform.two", sigHandler),
              route(".perform.three", handler),
            ],
          },
        ],
      });
    });

    When("we start a sequence and get sigterm in the middle", async () => {
      await crd.publishMessage("trigger.event.some-name", {
        type: "order",
        id: "some-id",
        meta: { correlationId: "some-correlation-id" },
        attributes: { baz: true },
      });
    });

    Then("there should be one active handler", () => {
      require("../../lib/active-handlers").totalActive().should.eql(1);
    });

    And("it should shutdown", (done) => {
      process.once("test-exit", () => {
        require("../../lib/graceful-shutdown").reset();
        process.removeAllListeners();
        done();
      });
    });
  });
});
