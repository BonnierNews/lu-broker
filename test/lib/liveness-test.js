"use strict";

const config = require("exp-config");
const nock = require("nock");
const {rabbitStatus} = require("../../liveness");

Feature("Liveness", () => {
  beforeEachScenario(() => {
    nock.disableNetConnect();
    nock.cleanAll();
  });
  afterEachScenario(() => nock.enableNetConnect());
  Scenario("It returns a 0", () => {
    Given("we can get a rabbit hostname", () => {
      nock(config.rabbit.apiUrl)
        .get("/api/connections")
        .basicAuth({user: "guest", pass: "guest"})
        .reply(200, [
          {
            // eslint-disable-next-line camelcase
            client_properties: {
              // eslint-disable-next-line camelcase
              connection_name: config.HOSTNAME
            }
          }
        ]);
    });
    let result;
    When("we ask if rabbit is alive", async () => {
      result = await rabbitStatus();
    });
    Then("we should get a 0 telling lu-broker to stay alive", () => {
      result.should.eql(0);
    });
  });

  Scenario("It returns a 1", () => {
    Given("we can get a rabbit hostname", () => {
      nock(config.rabbit.apiUrl)
        .get("/api/connections")
        .reply(200, [
          {
            // eslint-disable-next-line camelcase
            client_properties: {
              // eslint-disable-next-line camelcase
              connection_name: "NOT_MY_HOSTNAME"
            }
          }
        ]);
    });
    let result;
    When("we ask if rabbit is alive", async () => {
      result = await rabbitStatus();
    });
    Then("we should get a 1 telling lu-broker to kill itself", () => {
      result.should.eql(1);
    });
  });

  Scenario("It returns a 1, server error", () => {
    Given("we can get a rabbit hostname", () => {
      nock(config.rabbit.apiUrl).get("/api/connections").reply(503, [{}]);
    });
    let result;
    When("we ask if rabbit is alive", async () => {
      result = await rabbitStatus();
    });
    Then("we should get a 1 telling lu-broker to kill itself", () => {
      result.should.eql(1);
    });
  });
});
