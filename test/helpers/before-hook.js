"use strict";
// eslint-disable-next-line no-undef
const {purgeQueues, deleteQueues} = require("./rabbit-helper");
before(async () => {
  await purgeQueues();
});

after(async () => {
  await deleteQueues();
});
