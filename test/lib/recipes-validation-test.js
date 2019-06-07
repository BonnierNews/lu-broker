"use strict";

const {route} = require("../../index");
const recipesRepo = require("../../lib/recipe-repo");

const passThru = (msg) => msg;

describe("recipes-repo validation", () => {
  const allowedVerbs = ["get-or-create", "get", "update", "upsert", "delete", "validate", "perform"];
  const events = [
    {
      name: "one",
      namespace: "event",
      sequence: [route(".perform.first", passThru)]
    },
    {
      name: "two",
      namespace: "event",
      sequence: [route(".perform.second", passThru), route("event.one.perform.first", passThru)]
    }
  ];

  describe("validate recipe structure", () => {
    it("should not allow unknown keys", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], foobar: "foobar"}]);
      }.should.throw(Error, /value: "foobar" detail: "foobar" is not allowed/));
    });
  });

  describe("validate keys and lambdas", () => {
    it.skip("should not allow borrowing from unknown key", () => {
      (function() {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [...events[1].sequence, route("event.one.perform.three", passThru)]}
        ]);
      }.should.throw(Error, /Not all lambdas exists in recipe sequence keys, invalid lambda: event.one.perform.three/));
    });

    it("should require a fn for internal keys");
    it("should not allow borrowing from unknown keys");

    it("should return allow duplicates in sequence", () => {
      (function() {
        recipesRepo.init([
          {
            namespace: "event",
            name: "bax",
            sequence: [route(".perform.one", passThru), route(".perform.one", passThru)]
          }
        ]);
      }.should.throw(Error, /detail: "sequence" position 1 contains a duplicate value/));
    });

    it("should not allow more than 4 parts if no agumentation", () => {
      (function() {
        recipesRepo.init([
          {
            name: "one",
            namespace: "event",
            sequence: [route(".perform.first.not-allowed", passThru)]
          }
        ]);
      }.should.throw(Error, /.perform.first.not-allowed/));
    });

    it("should not allow less than 4 parts if no agumentation", () => {
      (function() {
        recipesRepo.init([
          {
            name: "one",
            namespace: "event",
            sequence: [route(".perform", passThru)]
          }
        ]);
      }.should.throw(Error, /.perform/));
    });

    it("should not allow more than 5 parts if agumentation", () => {
      (function() {
        recipesRepo.init([
          {
            name: "one",
            namespace: "event",
            sequence: [route(".optional.perform.first.not-allowed", passThru)]
          }
        ]);
      }.should.throw(Error, /.optional.perform.first.not-allowed/));
    });

    it("should not allow less than 5 parts if agumentation", () => {
      (function() {
        recipesRepo.init([
          {
            name: "one",
            namespace: "event",
            sequence: [route(".optional.perform", passThru)]
          }
        ]);
      }.should.throw(Error, /.optional.perform/));
    });
  });

  describe("validate verbs", () => {
    it("should not allow unknown verbs", () => {
      (function() {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [route(".fimp.first", passThru), events[1].sequence[1]]}
        ]);
      }.should.throw(Error, /Invalid verb in .fimp.first/));
      (function() {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [route("event.one.fimp.first", passThru), events[1].sequence[1]]}
        ]);
      }.should.throw(Error, /Invalid verb in event.one.fimp.first/));
    });

    it("should allow known verbs", () => {
      const innerLambdas = {};
      const innerEvents = [
        {
          name: "one",
          namespace: "event",
          sequence: []
        }
      ];
      allowedVerbs.forEach((verb) => {
        innerEvents[0].sequence.push(route(`.${verb}.anything`, passThru));
      });

      (function() {
        recipesRepo.init(innerEvents, innerLambdas);
      }.should.not.throw(Error));
    });

    it("should allow known verbs when borrowing (plus agumentation)", () => {
      const innerEvents = [
        {
          name: "one",
          namespace: "event",
          sequence: []
        },
        {
          name: "two",
          namespace: "event",
          sequence: []
        },
        {
          name: "three",
          namespace: "event",
          sequence: []
        }
      ];
      allowedVerbs.forEach((verb) => {
        innerEvents[0].sequence.push(route(`.${verb}.anything`, passThru));
        innerEvents[0].sequence.push(route(`.optional.${verb}.anything`, passThru));
        innerEvents[1].sequence.push(route(`event.one.${verb}.anything`, passThru));
        innerEvents[1].sequence.push(route(`event.one.optional.${verb}.anything`, passThru));
      });

      (function() {
        recipesRepo.init(innerEvents);
      }.should.not.throw(Error));
    });

    it("should allow known verbs when agumentation", () => {
      const innerEvents = [
        {
          name: "one",
          namespace: "event",
          sequence: []
        }
      ];
      allowedVerbs.forEach((verb) => {
        innerEvents[0].sequence.push(route(`.optional.${verb}.anything`, passThru));
      });

      (function() {
        recipesRepo.init(innerEvents);
      }.should.not.throw(Error));
    });

    it("should not allow unknown agumentation ", () => {
      const innerEvents = [
        {
          name: "one",
          namespace: "event",
          sequence: []
        }
      ];
      allowedVerbs.forEach((verb) => {
        innerEvents[0].sequence.push(route(`.baz.${verb}.anything`, passThru));
      });

      (function() {
        recipesRepo.init(innerEvents);
      }.should.throw(Error, /Invalid step .baz.get-or-create.anything/));
    });
  });

  describe("validate namespace names", () => {
    it("should not allow unknown namespaces", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], namespace: "foobar"}]);
      }.should.throw(Error, 'value: "foobar" detail: "namespace" must be one of [event, action]'));
    });
    it("should allow known namespaces", () => {
      (function() {
        recipesRepo.init([
          {
            namespace: "event",
            name: "one",
            sequence: [route(".perform.first")]
          },
          {
            namespace: "action",
            name: "two",
            sequence: [route(".perform.second")]
          }
        ]);
      }.should.not.throw(Error));
    });
  });

  describe("validate event names", () => {
    it("should not allow duplicates", () => {
      (function() {
        recipesRepo.init([...events, events[0]]);
      }.should.throw(Error, /duplicate value/));
    });
    it("should not allow invalid chars", () => {
      (function() {
        recipesRepo.init([events[0], {...events[1], name: ".hej"}]);
      }.should.throw(
        Error,
        'value: ".hej" detail: "name" with value ".hej" fails to match the required pattern: /^[a-z][-a-z.]*$/'
      ));
      (function() {
        recipesRepo.init([events[0], {...events[1], name: "#hej"}]);
      }.should.throw(
        Error,
        'value: "#hej" detail: "name" with value "#hej" fails to match the required pattern: /^[a-z][-a-z.]*$/'
      ));
    });
  });
});
