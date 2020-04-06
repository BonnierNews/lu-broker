"use strict";

const config = require("exp-config");
const {logger} = require("lu-logger");
const uuid = require("uuid");
const {totalActive} = require("./active-handlers");
const {crd, reject} = require("./broker");

const sigtermEvent = config.sigtermEvent || "SIGTERM";
const shutDownProbeInterval = config.shutDownProbeInterval || 1000;
let shuttingDown = false;
let shutDownDebugMeta;

function init() {
  process.on(sigtermEvent, () => {
    shutDownDebugMeta = shutDownDebugMeta || {meta: {correlationId: uuid.v4()}};
    logger.info(`SIGTERM received, active handlers ${totalActive()}`, shutDownDebugMeta);
    if (shuttingDown) {
      logger.info("Shutdown in progress", shutDownDebugMeta);
      return;
    }
    shuttingDown = true;
    logger.info("Start handling the sigterm, shutting down", shutDownDebugMeta);
    setInterval(() => {
      if (totalActive() === 0) {
        logger.info("All handlers are done, shutting down", shutDownDebugMeta);
        crd.unsubscribeAll(() => {
          logger.info("Unsubscribed crd", shutDownDebugMeta);
          reject.unsubscribeAll(() => {
            logger.info("Unsubscribed reject", shutDownDebugMeta);
            if (config.envName === "test") {
              process.emit("test-exit");
            } else {
              process.exit(0); // eslint-disable-line no-process-exit
            }
          });
        });
      } else {
        logger.warning(`There are ${totalActive()} ongoing handlers, waiting for them to finish`, shutDownDebugMeta);
      }
    }, shutDownProbeInterval);
  });
}

function isShuttingDown() {
  return shuttingDown;
}

function reset() {
  shuttingDown = false;
}

module.exports = {init, isShuttingDown, reset};
