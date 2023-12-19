As of 2023-12-15 this project is no longer used, and the repo has been archived.

# lu-broker
![Node.js CI](https://github.com/BonnierNews/lu-broker/actions/workflows/nodejs.yml/badge.svg)

Welcome to the lu-broker repo. This is a module used when building rabbitmq based workers.

example code:

```js
const {start, route} = require("lu-broker");
const broker = start({
  triggers: {
    "trigger.order-v2--notification": orderV2NotificationTrigger
  },
  recipes: [
    {
      namespace: "sequence",
      name: "order-notification",
      sequence: [route(".perform.notification", require("./lib/lambdas/order-notification/perform"))]
    },
  ]
});
```

## Trigger a flow:

Each sequence has a few ways to be triggered:

### The implicit trigger:

* publish a rabbitmq message on `trigger.<namespace>.<name>` with a message that will be exposed as `source` in the lambda

```js
await crd.publishMessage("trigger.sequence.order-notification", source);
```

* perform a http POST on  `/trigger/<namespace>/<name>` with a body that will be exposed as `source` in the lambda

```js
await request.post("/trigger/sequence/order-notification", source);
```


### The explicit trigger

Define a trigger function returning `type: "trigger", id: "<namespace>.<name>"` :

```js
function trigger(source) {
    return {
      type: "trigger",
      id: "sequence.order-notification",
      source,
      meta: {
        correlationId: "some-correlation-id"
      }
    };
  }

```

and register it as trigger (as above)

then

* publish a rabbitmq message on `trigger.<key>` with a message that will be exposed as `source` in the lambda

```js
await crd.publishMessage("trigger.order-v2--notification", source);
```

* perform a http POST on  `/trigger/<key>` with a body that will be exposed as `source` in the lambda

```js
await request.post("/trigger/order-v2--notification", source);
```

## Writing a lambda

When implementing a sequence, try to split the flow into atomic operations. Each operation should be their own lambda. Each lambda should be idempotent, i.e. respect the current state so they can run again and again

example code:

```js

function myLambda(message, context) {

  return {
    type: "baz",
    id: "some-id"
  }
}
 ```


* If the lambda was successful return `type, id` which will then be appended to the message and the flow will move on to the next step.
* If the lambda already has run, return `type, id` and the flow will move on to the next step.
* If the lambda returns `null` the flow will move on but nothing will be appended to the message.
* If the lambda returns `type, id` with `type === "trigger"` it will trigger another sequence

example:

```js

function myTriggerLambda(message, context) {
    return {
      type: "trigger",
      id: "event.some-sequence-name",
      source: message.source,
      meta: {
        correlationId: "some-correlation-id"
      }
    };
  }
```
## Version notes:
v2.x supports node 8,10 (but works at least to node 14)
v3.x supports node 12,14,16
