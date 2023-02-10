"use strict";

const config = require("exp-config");
const fakeApi = require("../helpers/fake-api");
const {assertCaseCreated, assertRejected, assertRetry, assertUnrecoverable} = require("../../lib/test-helpers");
const {caseIf, rejectIf, retryIf, unrecoverableIf} = require("../../lib/reject-helpers");

const caseBody = {
  contact: {id: "some-contact-id"},
  namespace: "some-namespace",
  businessType: "b2c",
  origin: "your-system",
  subject: "Some subject",
  priority: "low",
  description: "Something has happend that the system can't deal with",
  category: "Back-office",
  sourceQueue: "BO-queue",
  owner: "Back office agents",
  externalReference: "some-id"
};

async function caseIt() {
  await caseIf(true, caseBody);
}

function reject() {
  rejectIf(true, "We have rejected!");
}

function retry() {
  retryIf(true, "We have retried!");
}

function unrecoverable() {
  unrecoverableIf(true, "We have made it unrecoverable");
}

Feature("Testing the test-helpers", () => {
  Scenario("Create case", () => {
    let response;

    Given("we can create a case in salesforce-api", () => {
      const payload = {...caseBody};
      delete payload.namespace;
      const request = {
        request: {
          path: `${config.salesforceApiUrl}/some-namespace/case`,
          method: "post",
          body: payload
        },
        statusCode: 200,
        body: {id: "some-case-id"}
      };
      fakeApi.mount(request);
    });

    When("running a function that will create a case", async () => {
      response = await assertCaseCreated(() => caseIt());
    });

    And("we wait for the case to be created", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    Then("the response should include the created sfdc case", () => {
      response.caseCreated.should.eql("some-case-id");
    });
  });

  Scenario("Reject", () => {
    let response;
    When("running a function that will reject", async () => {
      response = await assertRejected(() => reject());
    });

    Then("the response should be rejected", () => {
      response.message.should.eql("We have rejected!");
    });
  });

  Scenario("Retry", () => {
    let response;
    When("running a function that will retry", async () => {
      response = await assertRetry(() => retry());
    });

    Then("the response should be retried", () => {
      response.message.should.eql("We have retried!");
    });
  });

  Scenario("Unrecoverable", () => {
    let response;
    When("running a function that will do unrecoverable", async () => {
      response = await assertUnrecoverable(() => unrecoverable());
    });

    Then("the response should be unrecoverable", () => {
      response.message.should.eql("We have made it unrecoverable");
    });
  });
});
