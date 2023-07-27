"use strict";

let active = 0;

function inc() {
  active++;
}

function dec() {
  active--;
}

function totalActive() {
  return active;
}

module.exports = { inc, dec, totalActive };
