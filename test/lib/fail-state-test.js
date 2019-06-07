"use strict";
const {route} = require("../..");
const buildFlowHandler = require("../../lib/handle-flow-message");
const recipeRepo = require("../../lib/recipe-repo");
const {crd} = require("../helpers/queue-helper");

describe("Lamba should throw if returning message or other irrelevant info", () => {
  const passThru = (msg) => msg;
  const valid = () => Object({type: "other", id: "guid-2"});
  const eventer = () => Object({type: "event", id: "guid"});
  let handleFlowMessage;

  before(() => {
    crd.resetMock();

    const recipes = [
      {
        namespace: "event",
        name: "failer",
        sequence: [route(".perform.one", passThru), route(".perform.valid", valid)]
      },
      {
        namespace: "event",
        name: "failer2",
        sequence: [route(".perform.one", eventer)]
      }
    ];
    const recipeMap = recipeRepo.init(recipes);
    handleFlowMessage = buildFlowHandler(recipeMap);
  });

  it("should allow valid", async () => {
    await handleFlowMessage(
      {
        type: "event",
        data: [{type: "baz", id: "foo"}]
      },
      {
        fields: {
          routingKey: "event.failer.perform.valid"
        },
        properties: {
          replyTo: "even.failer.processed"
        }
      },
      {
        ack: () => {},
        nack: () => {}
      }
    );
  });

  it("should fail on passThru", async () => {
    try {
      await handleFlowMessage(
        {
          type: "event",
          data: [{type: "baz", id: "foo"}]
        },
        {
          fields: {
            routingKey: "event.failer.perform.one"
          },
          properties: {
            replyTo: "even.failer.processed"
          }
        },
        {
          ack: () => {},
          nack: () => {}
        }
      );
    } catch (err) {
      return err.message.should.match(/Invalid response on routing key: event.failer.perform.one/);
    }
    throw new Error("Did not throw");
  });

  it("should fail on passThru", async () => {
    try {
      await handleFlowMessage(
        {
          type: "event",
          data: [{type: "baz", id: "foo"}]
        },
        {
          fields: {
            routingKey: "event.failer2.perform.one"
          },
          properties: {
            replyTo: "even.failer2.processed"
          }
        },
        {
          ack: () => {},
          nack: () => {}
        }
      );
    } catch (err) {
      return err.message.should.match(/Invalid response on routing key: event.failer2.perform.one/);
    }
    throw new Error("Did not throw");
  });
});
