"use strict";
const recipeRepo = require("../../lib/recipe-repo");

Feature("Recipes", () => {
  Scenario("Getting routingKeys for recipe", () => {
    let recipes;
    Given("A single recipe with 3 keys", () => {
      const recipe = {
        namespace: "event",
        name: "some-name",
        sequence: [".one", ".two", ".three"]
      };
      recipes = recipeRepo.init([recipe]);
    });

    let first;
    When("getting first key for event", () => {
      first = recipes.first("event", "some-name");
    });

    Then("the first key and its reply key should be correct", () => {
      first.routingKey.should.eql("event.some-name.one");
      first.replyTo.should.eql("event.some-name.two");
    });

    let next;
    When("getting next key for the first routing key", () => {
      next = recipes.next(first.routingKey);
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.some-name.two");
      next.replyTo.should.eql("event.some-name.three");
    });

    When("getting next key for the second routing key", () => {
      next = recipes.next(next.routingKey);
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.some-name.three");
      next.replyTo.should.eql("event.some-name.processed");
    });

    When("getting next key for the processed routing key", () => {
      next = recipes.next(next.replyTo);
    });

    Then("the key and reply key should be empty", () => {
      next.routingKey.should.eql("");
      next.replyTo.should.eql("");
    });
  });
});
