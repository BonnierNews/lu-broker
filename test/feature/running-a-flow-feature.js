"use strict";

const {start} = require("../../");
const queueHelper = require("../helpers/queue-helper");
const lambdasMap = {
  "event.some-name.one": handler
};

function handler(message) {
  message.data.push({type: "i-was-here", id: "my-guid"});
  return message;
}
start({
  lambdas: lambdasMap
});

Feature("Lamda functions", () => {
  Scenario("Trigger a lambda function from a known key", () => {
    let messages;
    Given("we are listening for messages", () => {});

    When("publishing a message on a known key", async () => {
      messages = await queueHelper.publishAndConsumeReply("event.some-name.one", {type: "foo", data: []});
    });

    Then("the lambda should be triggered, and return the expected result", () => {
      messages.length.should.eql(1);
      const {msg, key} = messages.pop();
      msg.should.eql("sdfdsf");
    });
  });
});
