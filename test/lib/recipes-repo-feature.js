"use strict";
const recipeRepo = require("../../lib/recipe-repo");
const chai = require("chai");
const should = chai.should();

// function amqpMeta(routingKey, eventName) {
//   return {
//     properties: {headers: {eventName}},
//     fields: {routingKey}
//   };
// }

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
      next = recipes.next("event", "some-name", "event.some-name.one");
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.some-name.two");
      next.replyTo.should.eql("event.some-name.three");
    });

    When("getting next key for the second routing key", () => {
      next = recipes.next("event", "some-name", next.routingKey);
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.some-name.three");
      next.replyTo.should.eql("event.some-name.processed");
    });

    When("getting next key for the processed routing key", () => {
      next = recipes.next("event", "some-name", next.replyTo);
    });

    Then("the key and reply key should be empty", () => {
      should.not.exist(next.routingKey);
      should.not.exist(next.replyTo);
    });
  });

  Scenario("Getting routingKeys for recipe with dependencies", () => {
    let recipes;
    Given("A two recipe with keys", () => {
      const recipe = {
        namespace: "event",
        name: "some-name",
        sequence: [".one", "event.v2.two", ".three"]
      };
      const other = {
        namespace: "event",
        name: "v2",
        sequence: [".two"]
      };
      recipes = recipeRepo.init([recipe, other]);
    });

    let first;
    When("getting first key for event", () => {
      first = recipes.first("event", "some-name");
    });

    Then("the first key and its reply key should be correct", () => {
      first.routingKey.should.eql("event.some-name.one");
      first.replyTo.should.eql("event.v2.two");
    });

    let next;
    When("getting next key for the first routing key", () => {
      next = recipes.next("event", "some-name", "event.some-name.one");
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.v2.two");
      next.replyTo.should.eql("event.some-name.three");
    });

    When("getting next key for the second routing key", () => {
      next = recipes.next("event", "some-name", next.routingKey);
    });

    Then("the key and reply key should be correct", () => {
      next.routingKey.should.eql("event.some-name.three");
      next.replyTo.should.eql("event.some-name.processed");
    });

    When("getting next key for the processed routing key", () => {
      next = recipes.next("event", "some-name", next.replyTo);
    });

    Then("the key and reply key should be empty", () => {
      should.not.exist(next.routingKey);
      should.not.exist(next.replyTo);
    });
  });
});
