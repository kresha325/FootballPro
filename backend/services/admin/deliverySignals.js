'use strict';

const counters = {
  email: 0,
  push: 0,
  invalidToken: 0,
};

function note(channel) {
  if (!Object.prototype.hasOwnProperty.call(counters, channel)) return;
  counters[channel] += 1;
}

function snapshot() {
  return { ...counters, scope: 'process' };
}

function resetDeliverySignals() {
  counters.email = 0;
  counters.push = 0;
  counters.invalidToken = 0;
}

module.exports = {
  note,
  snapshot,
  resetDeliverySignals,
};
