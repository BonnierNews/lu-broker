"use strict";
const request = require("supertest")("http://localhost:3000");
const {start, stop} = require("../..");

Feature("Metrics server", () => {
  afterEachScenario(stop);
  Scenario("Metrics are exposed", () => {
    Given("broker is started", () => {
      start({
        recipes: []
      });
    });

    let response;
    When("requesting the /metrics endpoint", async () => {
      response = await request.get("/metrics");
    });

    Then("the response should be a 200 OK", () => {
      response.statusCode.should.eql(200);
    });

    And("the response should contain prometheus metrics", () => {
      response.text.should.contain("TYPE nodejs_version_info gauge");
    });

    When("requesting some other endpoint", async () => {
      response = await request.get("/something");
    });

    Then("the response should be a 404", () => {
      response.statusCode.should.eql(404);
    });
  });
});
