"use strict";
// eslint-disable-next-line no-undef
const {purgeQueues} = require("./rabbit-helper");
before(async () => {
  await purgeQueues();
});
