"use strict";

const { start, route, stop } = require("../..");
const { crd, reject } = require("../helpers/queue-helper");
const fakeApi = require("../helpers/fake-api")();
const config = require("exp-config");

const caseBody = {
  contact: { id: "some-contact-id" },
  namespace: "BN",
  businessType: "b2c",
  origin: "your-system",
  subject: "Some subject",
  priority: "low",
  description: "Something has happened that the system can't deal with",
  category: "Övriga ärenden",
  sourceQueue: "BNBO",
  owner: "BNBO",
  externalReference: "some-id",
};
async function caseIfHandler(message, context) {
  const { caseIf } = context;
  await caseIf(true, { ...caseBody });
}

async function caseUnlessHandler(message, context) {
  const { caseUnless } = context;
  await caseUnless(false, { ...caseBody });
}

async function missingRequiredPropCaseHandler(message, context) {
  const { caseIf } = context;
  const badCaseBody = { ...caseBody };
  delete badCaseBody.origin;
  await caseIf(true, badCaseBody);
}

async function unallowedPropCaseHandler(message, context) {
  const { caseIf } = context;
  const badCaseBody = { ...caseBody };
  badCaseBody.anUnallowedProp = "tjohoppsan";
  await caseIf(true, badCaseBody);
}

Feature("Create sfdc case", () => {
  afterEachScenario(stop);
  const source = {
    type: "order",
    id: "some-id",
    meta: { correlationId: "some-correlation-id" },
    attributes: { baz: true },
  };

  Scenario("Create a sfdc case with if and exit the sequence", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "some-name",
            sequence: [ route(".perform.one", caseIfHandler) ],
          },
        ],
      });
    });

    let processedMessages;
    Given("we are listening for processed sfdc case created messages", () => {
      processedMessages = crd.subscribe("sequence.some-name.perform.one.sfdc-case-created.processed");
    });

    let caseMount;
    And("we can create a case in salesforce-api", () => {
      const payload = { ...caseBody };
      delete payload.namespace;
      const request = {
        request: {
          path: `${config.salesforceApiUrl}/BN/case`,
          method: "post",
          body: payload,
        },
        statusCode: 200,
        body: { id: "some-case-id" },
      };
      caseMount = fakeApi.mount(request);
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.sequence.some-name", source);
    });

    And("we wait for the case to be created", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    Then("we should have sent the correct data to salesforce", () => {
      caseMount.hasExpectedBody();
    });

    And("there should be a sfdc case created processed message", () => {
      processedMessages.length.should.eql(1);
    });

    And("the processed message should hold data from the created case", () => {
      processedMessages[0].msg.data
        .map(({ id, key, type }) => Object({ type, key, id }))
        .should.eql([
          {
            id: "some-case-id",
            key: "sequence.some-name.perform.one.sfdc-case-created",
            type: "sfdc__case",
          },
        ]);
    });
  });

  Scenario("Create a sfdc case with unless and exit the sequence", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "some-name",
            sequence: [ route(".perform.one", caseUnlessHandler) ],
          },
        ],
      });
    });

    let processedMessages;
    Given("we are listening for processed sfdc case created messages", () => {
      processedMessages = crd.subscribe("sequence.some-name.perform.one.sfdc-case-created.processed");
    });

    let caseMount;
    And("we can create a case in salesforce-api", () => {
      const payload = { ...caseBody };
      delete payload.namespace;
      const request = {
        request: {
          path: `${config.salesforceApiUrl}/BN/case`,
          method: "post",
          body: payload,
        },
        statusCode: 200,
        body: { id: "some-case-id" },
      };
      caseMount = fakeApi.mount(request);
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.sequence.some-name", source);
    });

    And("we wait for the case to be created", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    Then("we should have sent the correct data to salesforce", () => {
      caseMount.hasExpectedBody();
    });

    And("there should be a sfdc case created processed message", () => {
      processedMessages.length.should.eql(1);
    });

    And("the processed message should hold data from the created case", () => {
      processedMessages[0].msg.data
        .map(({ id, key, type }) => Object({ type, key, id }))
        .should.eql([
          {
            id: "some-case-id",
            key: "sequence.some-name.perform.one.sfdc-case-created",
            type: "sfdc__case",
          },
        ]);
    });
  });

  Scenario("Reject because sfdc case doesn't contain required property", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "some-name",
            sequence: [ route(".perform.one", missingRequiredPropCaseHandler) ],
          },
        ],
      });
    });

    let rejectedMessages;
    Given("we are listening for rejected messages", () => {
      rejectedMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.sequence.some-name", source);
    });

    Then("the message should be rejected", () => {
      rejectedMessages.length.should.eql(1);
      rejectedMessages[0].key.should.eql("sequence.some-name.perform.one");
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(1);
    });

    And("the rejected message should eql the nacked message saying a required prop is missing", () => {
      reject.nackedMessages[0].should.eql(rejectedMessages[0].msg);
      reject.nackedMessages[0].errors[0].title.should.contain("doesn't contain the required property");
    });

    And("the rejected message should have x-routing-key set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property(
        "x-routing-key",
        "sequence.some-name.perform.one"
      );
    });

    And("the rejected message should have correct routingKey", () => {
      rejectedMessages[0].meta.fields.routingKey.should.eql("sequence.some-name.perform.one");
    });
  });

  Scenario("Reject because sfdc case contains an unallowed property", () => {
    before(() => {
      crd.resetMock();
      reject.resetMock();
      start({
        recipes: [
          {
            namespace: "sequence",
            name: "some-name",
            sequence: [ route(".perform.one", unallowedPropCaseHandler) ],
          },
        ],
      });
    });

    let rejectedMessages;
    Given("we are listening for rejected messages", () => {
      rejectedMessages = reject.subscribe("#");
    });

    When("we publish an order on a trigger key", async () => {
      await crd.publishMessage("trigger.sequence.some-name", source);
    });

    Then("the message should be rejected", () => {
      rejectedMessages.length.should.eql(1);
      rejectedMessages[0].key.should.eql("sequence.some-name.perform.one");
    });

    And("the reject queue should have a nacked message", () => {
      reject.nackedMessages.should.have.length(1);
    });

    And("the rejected message should eql the nacked message saying a prop isn't allowed", () => {
      reject.nackedMessages[0].should.eql(rejectedMessages[0].msg);
      reject.nackedMessages[0].errors[0].title.should.contain("which isn't allowed");
    });

    And("the rejected message should have x-routing-key set", () => {
      rejectedMessages[0].meta.properties.headers.should.have.property(
        "x-routing-key",
        "sequence.some-name.perform.one"
      );
    });

    And("the rejected message should have correct routingKey", () => {
      rejectedMessages[0].meta.fields.routingKey.should.eql("sequence.some-name.perform.one");
    });
  });
});
