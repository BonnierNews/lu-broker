"use strict";

const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo validation", () => {
  const lambdas = {
    "event.one.perform.first": passThru,
    "event.two.perform.get.second": passThru
  };
  const events = [
    {
      name: "one",
      namespace: "event",
      sequence: [".perform.first"]
    },
    {
      name: "two",
      namespace: "event",
      sequence: [".perform.get.second", "event.one.perform.first"]
    }
  ];
  describe("validate recipe structure", () => {
    it("should not allow unknown keys", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], foobar: "foobar"}], lambdas);
      }.should.throw(Error, /value: "foobar" detail: "foobar" is not allowed/));
    });
  });
  describe("validate keys and lambdas", () => {
    it("should not allow sequence keys that not exist in lamda map", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [...events[1].sequence, ".perform.three"]}], {
          ...lambdas
        });
      }.should.throw(Error, "Not all recipe sequence keys exists in lambdas, invalid key: event.two.perform.three"));
    });
    it("should not allow lamdas that not exist in sequence keys", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [events[1].sequence[1]]}], {
          ...lambdas
        });
      }.should.throw(
        Error,
        "Not all lambdas exists in recipe sequence keys, invalid lambda: event.two.perform.get.second"
      ));
    });
    it.skip("should not allow borrowing from unknown key", () => {
      //TODO
    });
    it.skip("should not allow duplicate keys via synonyms", () => {
      //TODO
    });
    it("should not allow duplicates in sequence", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [events[1].sequence[0], events[1].sequence[0]]}], {
          ...lambdas
        });
      }.should.throw(Error, 'value: ".perform.get.second" detail: "sequence" position 1 contains a duplicate value'));
    });
  });
  describe("validate verbs", () => {
    it("should not allow unknown verbs", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: ["fimp.first", events[1].sequence[1]]}], {
          ...lambdas,
          "event.two.fimp.first": passThru
        });
      }.should.throw(Error, /value: "fimp\.first" detail: "0" with value "fimp\.first"/));
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: ["event.one.fimp.first", events[1].sequence[1]]}], {
          ...lambdas,
          "event.one.fimp.first": passThru
        });
      }.should.throw(Error, /value: "event\.one\.fimp\.first" detail: "0" with value "event.one.fimp.first/));
    });
    it("should allow known verbs", () => {
      const allowedVerbs = ["get-or-create", "get", "update", "upsert", "delete", "validate", "perform"];
      const innerLambdas = {};
      const innerEvents = [
        {
          name: "one",
          namespace: "event",
          sequence: []
        }
      ];
      allowedVerbs.forEach((verb) => {
        innerLambdas[`event.one.${verb}.anything`] = passThru;
        innerEvents[0].sequence.push(`.${verb}.anything`);
      });

      (function() {
        recipesRepo.init(innerEvents, innerLambdas);
      }.should.not.throw(Error));
    });
  });
  describe("validate namespace names", () => {
    it("should not allow unknown namespaces", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], namespace: "foobar"}], lambdas);
      }.should.throw(Error, 'value: "foobar" detail: "namespace" must be one of [event, action]'));
    });
    it("should allow known namespaces", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], namespace: "event"}], lambdas);
      }.should.not.throw(Error));
      (function() {
        const copy = {...lambdas};
        delete copy["event.two.perform.get.second"];
        copy["action.two.perform.get.second"] = passThru;
        recipesRepo.init([events[0], {...events[1], namespace: "action"}], copy);
      }.should.not.throw(Error));
    });
  });
  describe("validate event names", () => {
    it("should not allow duplicates", () => {
      (function() {
        recipesRepo.init([...events, events[0]], lambdas);
      }.should.throw(
        Error,
        'value: {"name":"one","namespace":"event","sequence":[".perform.first"]} detail: "value" position 2 contains a duplicate value'
      ));
    });
    it("should not allow invalid chars", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], name: ".hej"}], lambdas);
      }.should.throw(
        Error,
        'value: ".hej" detail: "name" with value ".hej" fails to match the required pattern: /^[a-z][-a-z.]*$/'
      ));
      (function() {
        recipesRepo.init([events[0], {...events[1], name: "#hej"}], lambdas);
      }.should.throw(
        Error,
        'value: "#hej" detail: "name" with value "#hej" fails to match the required pattern: /^[a-z][-a-z.]*$/'
      ));
    });
  });
});
