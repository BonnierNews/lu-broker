# lu-broker

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

