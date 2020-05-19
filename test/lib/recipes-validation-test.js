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
      sequence: [route(".perform.second", passThru), route("event.one.perform.first")]
    }
  ];

  describe("validate recipe structure", () => {
    it("should not allow unknown keys", () => {
      (function () {
        recipesRepo.init([events[0], {...events[1], foobar: "foobar"}]);
      }.should.throw(Error, 'value: "foobar" detail: "[1].foobar" is not allowed'));
    });
  });

  describe("validate event keys", () => {
    it("should not allow borrowing from unknown key", () => {
      (function () {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [...events[1].sequence, route("event.one.perform.three")]}
        ]);
      }.should.throw(
        Error,
        /Error in 'event.two': borrowed key 'event.one.perform.three' does not exist in 'event.one'/
      ));
    });

    it("should not allow functions for borrowing", () => {
      (function () {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [events[1].sequence[0], route("event.one.perform.first", passThru)]}
        ]);
      }.should.throw(Error, /Handler function not allowed for borrowed key: 'event.one.perform.first' in 'event.two'/));
    });

    it("should require a fn for internal keys", () => {
      (function () {
        recipesRepo.init([
          {
            namespace: "event",
            name: "bax",
            sequence: [route(".perform.one")]
          }
        ]);
      }.should.throw(Error, /No function given for key '.perform.one' in 'event.bax'/));
    });

    it("should only allow functions for internal keys", () => {
      (function () {
        recipesRepo.init([
          {
            namespace: "event",
            name: "bax",
            sequence: [route(".perform.one", ".event.bar.hej")]
          }
        ]);
      }.should.throw(Error, /Only functions are supported as handlers/));
    });

    it("should not allow duplicates in sequence", () => {
      (function () {
        recipesRepo.init([
          {
            namespace: "event",
            name: "bax",
            sequence: [route(".perform.one", passThru), route(".perform.one", passThru)]
          }
        ]);
      }.should.throw(Error, 'value: {} detail: "[0].sequence[1]" contains a duplicate value'));
    });

    it("should not allow more than 4 parts if no agumentation", () => {
      (function () {
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
      (function () {
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
      (function () {
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
      (function () {
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

  describe("validate triggers", () => {
    it("should only allow functions for triggers", () => {
      (function () {
        recipesRepo.init([events[0]], {
          "trigger.baz": "hej.hopp"
        });
      }.should.throw(Error, /Only functions are supported as triggers/));
    });

    it("should only allow more than 2 parts in triggers", () => {
      (function () {
        recipesRepo.init([events[0]], {
          "trigger.baz.bar": passThru
        });
      }.should.throw(Error, /Invalid format for trigger.baz.bar/));
    });

    it("should only allow to start with trigger", () => {
      (function () {
        recipesRepo.init([events[0]], {
          "triggerzzz.baz": passThru
        });
      }.should.throw(Error, /Invalid format for triggerzzz.baz/));
    });
  });

  describe("validate verbs", () => {
    it("should not allow unknown verbs", () => {
      (function () {
        recipesRepo.init([
          events[0],
          {...events[1], sequence: [route(".fimp.first", passThru), events[1].sequence[1]]}
        ]);
      }.should.throw(Error, /Invalid verb in .fimp.first/));
      (function () {
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

      (function () {
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
        innerEvents[1].sequence.push(route(`event.one.${verb}.anything`));
        innerEvents[1].sequence.push(route(`event.one.optional.${verb}.anything`));
      });

      (function () {
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

      (function () {
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

      (function () {
        recipesRepo.init(innerEvents);
      }.should.throw(Error, /Invalid step .baz.get-or-create.anything/));
    });
  });

  describe("validate namespace names", () => {
    it("should not allow unknown namespaces", () => {
      (function () {
        recipesRepo.init([events[0], {...events[1], namespace: "foobar"}]);
      }.should.throw(Error, 'value: "foobar" detail: "[1].namespace" must be one of [event, action, sequence]'));
    });
    it("should allow known namespaces", () => {
      (function () {
        recipesRepo.init([
          {
            namespace: "event",
            name: "one",
            sequence: [route(".perform.first", passThru)]
          },
          {
            namespace: "action",
            name: "two",
            sequence: [route(".perform.second", passThru)]
          }
        ]);
      }.should.not.throw(Error));
    });
  });

  describe("validate event names", () => {
    it("should not allow duplicates", () => {
      (function () {
        recipesRepo.init([...events, events[0]]);
      }.should.throw(Error, /duplicate value/));
    });
    it("should not allow invalid chars", () => {
      (function () {
        recipesRepo.init([events[0], {...events[1], name: ".hej"}]);
      }.should.throw(
        Error,
        '.hej" detail: "[1].name" with value ".hej" fails to match the required pattern: /^[a-z0-9][-a-z0-9.]*$/'
      ));
      (function () {
        recipesRepo.init([events[0], {...events[1], name: "#hej"}]);
      }.should.throw(
        Error,
        'value: "#hej" detail: "[1].name" with value "#hej" fails to match the required pattern: /^[a-z0-9][-a-z0-9.]*$/'
      ));
    });
  });

  describe("validate unrecoverable keys", () => {
    it("should only allow *", () => {
      (function () {
        recipesRepo.init([{...events[1], unrecoverable: [{baz: () => {}}]}]);
      }.should.throw(Error, /Invalid key in unrecoverable: baz in event.two, allowed are '*'/));
    });
  });
});
