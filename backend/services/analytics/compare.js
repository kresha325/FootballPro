'use strict';

const COMPARABLE = [
  ['appearances', 'Appearances', 'matches'],
  ['starts', 'Starts', 'matches'],
  ['minutes', 'Minutes', 'minutes'],
  ['goals', 'Goals', 'goals'],
  ['assists', 'Assists', 'assists'],
  ['yellowCards', 'Yellow cards', 'cards'],
  ['redCards', 'Red cards', 'cards'],
  ['wins', 'Wins', 'matches'],
  ['draws', 'Draws', 'matches'],
  ['losses', 'Losses', 'matches'],
  ['rating', 'Rating', 'rating'],
];

function metricRows(left, right) {
  return COMPARABLE.map(([key, label, unit]) => ({
    key,
    label,
    unit,
    left: left?.[key] ?? null,
    right: right?.[key] ?? null,
    comparable: true,
  }));
}

function comparison({ kind, left, right, metricSet = 'match_performance' }) {
  return {
    kind,
    metricSet,
    label: 'Same match-performance metrics on both sides.',
    left,
    right,
    metrics: metricRows(left?.stats, right?.stats),
  };
}

module.exports = {
  COMPARABLE,
  metricRows,
  comparison,
};
