"use strict";

const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo validation", () => {
  const lambdas = {
    "event.one.changeme.first": passThru,
    "event.two.changeme.get.second": passThru
  };
  const events = [
    {
      name: "one",
      namespace: "event",
      sequence: [".changeme.first"]
    },
    {
      name: "two",
      namespace: "event",
      sequence: [".changeme.get.second", "event.one.changeme.first"]
    }
  ];
  describe("validate recipe structure", () => {
    it("should not allow unknown keys", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], foobar: "foobar"}], lambdas);
      }.should.throw(Error, 'value: "foobar" detail: "foobar" is not allowed'));
    });
  });
  describe("validate keys and lambdas", () => {
    it("should not allow sequence keys that not exist in lamda map", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [...events[1].sequence, ".changeme.three"]}], {
          ...lambdas
        });
      }.should.throw(Error, "Not all recipe sequence keys exists in lambdas, invalid key: event.two.changeme.three"));
    });
    it("should not allow lamdas that not exist in sequence keys", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [events[1].sequence[1]]}], {
          ...lambdas
        });
      }.should.throw(
        Error,
        "Not all lambdas exists in recipe sequence keys, invalid lambda: event.two.changeme.get.second"
      ));
    });
    it("should not allow borrowing from unknown key", () => {
      //TODO
    });
    it("should not allow duplicate keys via synonyms", () => {
      //TODO
    });
    it("should not allow duplicates in sequence", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: [events[1].sequence[0], events[1].sequence[0]]}], {
          ...lambdas
        });
      }.should.throw(Error, 'value: ".changeme.get.second" detail: "sequence" position 1 contains a duplicate value'));
    });
  });
  describe("validate verbs", () => {
    it("should not allow unknown verbs", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: ["fimp.first", events[1].sequence[1]]}], {
          ...lambdas,
          "event.two.fimp.first": passThru
        });
      }.should.throw(
        Error,
        'value: "fimp.first" detail: "0" with value "fimp.first" fails to match the required pattern: /^(.*\\..*)?\\.(changeme|validate)/'
      ));
      (function() {
        recipesRepo.init([events[0], {...events[1], sequence: ["event.one.fimp.first", events[1].sequence[1]]}], {
          ...lambdas,
          "event.one.fimp.first": passThru
        });
      }.should.throw(
        Error,
        'value: "event.one.fimp.first" detail: "0" with value "event.one.fimp.first" fails to match the required pattern: /^(.*\\..*)?\\.(changeme|validate)/'
      ));
    });
    it("should allow known verbs", () => {
      //TODO: add verbs when we have decided
      (function() {
        recipesRepo.init(events, lambdas);
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
        delete copy["event.two.changeme.get.second"];
        copy["action.two.changeme.get.second"] = passThru;
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
        'value: {"name":"one","namespace":"event","sequence":[".changeme.first"]} detail: "value" position 2 contains a duplicate value'
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
