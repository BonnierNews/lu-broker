"use strict";

const config = require("exp-config");
const { logger } = require("lu-logger");
const uuid = require("uuid");
const { totalActive } = require("./active-handlers");
const { crd, reject } = require("./broker");

const sigtermEvent = config.sigtermEvent || "SIGTERM";
const shutDownProbeInterval = config.shutDownProbeInterval || 1000;
let shuttingDown = false;
let shutDownDebugMeta;
let rejectShutdown;
let crdShutdown;

function init() {
  process.on(sigtermEvent, () => {
    shutDownDebugMeta = shutDownDebugMeta || { meta: { correlationId: uuid.v4() } };
    logger.info(`SIGTERM received, active handlers ${totalActive()}`, shutDownDebugMeta);
    if (shuttingDown) {
      logger.info("Shutdown in progress", shutDownDebugMeta);
      return;
    }
    shuttingDown = true;
    logger.info("Start handling the sigterm, shutting down", shutDownDebugMeta);
    setInterval(() => {
      logger.info(
        `Waiting for ${shutDownProbeInterval} milliseconds. crdShutdown: ${crdShutdown}, rejectShutdown:${rejectShutdown}`,
        shutDownDebugMeta
      );
      if (totalActive() === 0 && crdShutdown && rejectShutdown) {
        logger.info("No active handlers shutting down for real", shutDownDebugMeta);
        if (config.envName === "test") {
          process.emit("test-exit");
        } else {
          process.exit(0); // eslint-disable-line n/no-process-exit
        }
      }
      if (!crdShutdown && !rejectShutdown) {
        crd.unsubscribeAll(() => {
          crdShutdown = true;
          logger.info("Unsubscribed crd", shutDownDebugMeta);
          reject.unsubscribeAll(() => {
            rejectShutdown = true;
            logger.info("Unsubscribed reject", shutDownDebugMeta);
          });
        });
      }
      if (totalActive() !== 0 && crdShutdown && rejectShutdown) {
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

module.exports = { init, isShuttingDown, reset };
