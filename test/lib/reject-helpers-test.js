"use strict";

const config = require("exp-config");
const fakeApi = require("../helpers/fake-api")();
const {assertCaseCreated, assertRejected, assertRetry, assertUnrecoverable} = require("../../lib/test-helpers");
const {
  caseIf,
  caseUnless,
  rejectIf,
  rejectUnless,
  retryIf,
  retryUnless,
  unrecoverableIf,
  unrecoverableUnless
} = require("../../lib/reject-helpers");

const caseBody = {
  contact: {id: "some-contact-id"},
  namespace: "BN",
  businessType: "b2c",
  origin: "your-system",
  subject: "Some subject",
  priority: "low",
  description: "Something has happend that the system can't deal with",
  category: "Övriga ärenden",
  sourceQueue: "BNBO",
  owner: "BNBO",
  externalReference: "some-id"
};

Feature("Testing the reject-helpers", () => {
  beforeEachScenario(() => {
    fakeApi.reset();
  });
  Scenario("Create case if", () => {
    let response;

    Given("we can create a case in salesforce-api", () => {
      const payload = {...caseBody};
      delete payload.namespace;
      const request = {
        request: {
          path: `${config.salesforceApiUrl}/BN/case`,
          method: "post",
          body: payload
        },
        statusCode: 200,
        body: {id: "some-case-id"}
      };
      fakeApi.mount(request);
    });

    When("running a function that will create a case", async () => {
      response = await assertCaseCreated(() => caseIf(true, {...caseBody}));
    });

    And("we wait for the case to be created", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    Then("the response should include the created sfdc case", () => {
      response.caseCreated.should.eql("some-case-id");
    });
  });

  Scenario("Create case unless", () => {
    let response;

    Given("we can create a case in salesforce-api", () => {
      const payload = {...caseBody};
      delete payload.namespace;
      const request = {
        request: {
          path: `${config.salesforceApiUrl}/BN/case`,
          method: "post",
          body: payload
        },
        statusCode: 200,
        body: {id: "some-case-id"}
      };
      fakeApi.mount(request);
    });

    When("running a function that will create a case", async () => {
      response = await assertCaseCreated(() => caseUnless(false, caseBody));
    });

    And("we wait for the case to be created", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    Then("the response should include the created sfdc case", () => {
      response.caseCreated.should.eql("some-case-id");
    });
  });

  Scenario("Reject if", () => {
    let response;
    When("running a function that will reject", async () => {
      response = await assertRejected(() => rejectIf(true, "We have rejected!"));
    });

    Then("the response should be rejected", () => {
      response.message.should.eql("We have rejected!");
    });
  });

  Scenario("Reject unless", () => {
    let response;
    When("running a function that will reject", async () => {
      response = await assertRejected(() => rejectUnless(false, "We have rejected!"));
    });

    Then("the response should be rejected", () => {
      response.message.should.eql("We have rejected!");
    });
  });

  Scenario("Retry if", () => {
    let response;
    When("running a function that will retry", async () => {
      response = await assertRetry(() => retryIf(true, "We have retried!"));
    });

    Then("the response should be retried", () => {
      response.message.should.eql("We have retried!");
    });
  });

  Scenario("Retry unless", () => {
    let response;
    When("running a function that will retry", async () => {
      response = await assertRetry(() => retryUnless(false, "We have retried!"));
    });

    Then("the response should be retried", () => {
      response.message.should.eql("We have retried!");
    });
  });

  Scenario("Unrecoverable if", () => {
    let response;
    When("running a function that will do unrecoverable", async () => {
      response = await assertUnrecoverable(() => unrecoverableIf(true, "We have made it unrecoverable"));
    });

    Then("the response should be unrecoverable", () => {
      response.message.should.eql("We have made it unrecoverable");
    });
  });

  Scenario("Unrecoverable unless", () => {
    let response;
    When("running a function that will do unrecoverable", async () => {
      response = await assertUnrecoverable(() => unrecoverableUnless(false, "We have made it unrecoverable"));
    });

    Then("the response should be unrecoverable", () => {
      response.message.should.eql("We have made it unrecoverable");
    });
  });
});
