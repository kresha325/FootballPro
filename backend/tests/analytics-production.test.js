'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { aggregatePlayerStats } = require('../utils/playerStatsEngine');
const { buildPerformanceReport } = require('../utils/playerProfileCv');
const {
  engagementRate,
  interactionsPerPost,
  parseRange,
  ENGAGEMENT_RATE_FORMULA,
  METRIC_SOURCES,
} = require('../services/analytics/formulas');
const { projectPerformance, trendFromLines } = require('../services/analytics/playerMath');
const { foldStatusAggregates } = require('../services/analytics/marketplace');
const { foldWalletRows } = require('../services/analytics/wallet');
const { comparison } = require('../services/analytics/compare');
const { clubMatchResult } = require('../services/analytics/club');
const { modulesFor } = require('../services/analytics/dashboard');

function sampleBundle() {
  const matches = [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    homeUserId: 3,
    awayUserId: 4,
    scoreHome: id === 2 ? 0 : 2,
    scoreAway: id === 2 ? 1 : 0,
    status: 'finished',
    matchDate: `2026-09-0${id}`,
    tournamentId: id <= 4 ? 9 : 10,
    Tournament: {
      id: id <= 4 ? 9 : 10,
      name: id <= 4 ? 'Liga' : 'Cup',
      season: id <= 4 ? '2026/2027' : '2025/2026',
    },
  }));
  const statRows = matches.map((match) => ({
    matchId: match.id,
    userId: 7,
    side: 'home',
    started: true,
    minutes: 90,
    goals: 0,
    assists: match.id === 3 ? 1 : 0,
    yellowCards: match.id === 4 ? 1 : 0,
    rating: 7,
  }));
  const scorers = [
    { matchId: 1, userId: 7, goals: 2, assistUserId: null },
    { matchId: 6, userId: 7, goals: 1, assistUserId: 8 },
  ];
  const events = [
    { matchId: 1, userId: 7, type: 'goal' },
    { matchId: 1, userId: 7, type: 'goal' },
    { matchId: 1, userId: 7, type: 'yellow_card' },
    { matchId: 4, userId: 7, type: 'yellow_card' },
  ];
  return { matches, statRows, scorers, events };
}

describe('engagement formula', () => {
  it('uses one percentage formula and returns null without impressions', () => {
    const rate = engagementRate({ likes: 4, comments: 2, shares: 1, impressions: 20 });
    assert.equal(rate.formula, ENGAGEMENT_RATE_FORMULA);
    assert.equal(rate.rate, 35);
    assert.equal(rate.basis, 'impressions');
    const empty = engagementRate({ likes: 4, comments: 1, shares: 0, impressions: 0 });
    assert.equal(empty.rate, null);
    assert.equal(empty.sufficient, false);
    assert.notEqual(interactionsPerPost({ likes: 4, comments: 2, shares: 1, posts: 2 }), rate.rate);
  });
});

describe('date ranges', () => {
  it('accepts the dashboard presets and rejects unknown ranges', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    assert.equal(parseRange({ range: 'today' }, now).key, 'today');
    assert.equal(parseRange({ period: '30' }, now).key, '30d');
    assert.equal(parseRange({ range: 'career' }, now).cumulative, true);
    assert.equal(parseRange({ range: 'season' }, now).season, '2026/2027');
    assert.throws(() => parseRange({ range: 'forever' }, now), /Date range/);
  });

  it('does not treat career as a filtered window', () => {
    const range = parseRange({ range: 'career' });
    assert.equal(range.from, null);
    assert.equal(range.to, null);
  });
});

describe('player statistics reconciliation', () => {
  it('matches career goals, assists, minutes, and cards to the match engine', () => {
    const bundle = sampleBundle();
    const engine = aggregatePlayerStats(bundle);
    const mine = engine.find((row) => row.userId === 7);
    const report = buildPerformanceReport({ userId: 7, position: 'Forward', ...bundle });
    assert.equal(report.career.goals, mine.goals);
    assert.equal(report.career.goals, 3);
    assert.equal(report.career.assists, mine.assists);
    assert.equal(report.career.minutes, mine.minutes);
    assert.equal(report.career.minutes, 540);
    assert.equal(report.career.yellowCards, mine.yellowCards);
    assert.equal(report.career.appearances, 6);
    assert.equal(report.form.last5.appearances, 5);
    assert.equal(report.career.wins + report.career.draws + report.career.losses, 6);
  });

  it('does not double-count a card stored on both the event and the stat line', () => {
    const players = aggregatePlayerStats({
      events: [{ matchId: 4, userId: 7, type: 'yellow_card' }],
      statRows: [{ matchId: 4, userId: 7, minutes: 90, started: true, yellowCards: 1 }],
    });
    assert.equal(players[0].yellowCards, 1);
  });

  it('counts a stat-line card when no card event exists', () => {
    const players = aggregatePlayerStats({
      statRows: [{ matchId: 4, userId: 7, minutes: 80, started: true, yellowCards: 1, redCards: 0, assists: 2 }],
    });
    assert.equal(players[0].yellowCards, 1);
    assert.equal(players[0].assists, 2);
  });

  it('filters a season without changing the career total', () => {
    const bundle = sampleBundle();
    const view = projectPerformance(bundle, 7, 'Forward', { season: '2026/2027' });
    assert.equal(view.career.goals, 3);
    assert.equal(view.window.goals, 2);
    assert.equal(view.window.appearances, 4);
    assert.equal(view.career.appearances, 6);
    const older = projectPerformance(bundle, 7, 'Forward', { season: '2025/2026' });
    assert.equal(older.window.goals, 1);
    assert.equal(older.career.goals, 3);
  });

  it('marks a single match as insufficient for a trend line', () => {
    const trend = trendFromLines([{ matchId: 1, matchDate: '2026-09-01', goals: 1, assists: 0, minutes: 90, rating: 7 }]);
    assert.equal(trend.sufficient, false);
    assert.equal(trend.emptyReason, 'insufficient_data');
    assert.equal(trend.points.length, 1);
    const empty = trendFromLines([]);
    assert.equal(empty.emptyReason, 'no_matches');
  });
});

describe('marketplace and wallet reconciliation', () => {
  it('recognizes the same sale statuses and does not add mixed currencies', () => {
    const folded = foldStatusAggregates([
      { status: 'delivered', currency: 'JON', orders: 2, gross: '20.00', fees: '2.00', net: '18.00' },
      { status: 'paid', currency: 'JON', orders: 1, gross: '10.00', fees: '1.00', net: '9.00' },
      { status: 'refunded', currency: 'JON', orders: 1, gross: '10.00', fees: '1.00', net: '9.00' },
      { status: 'cancelled', currency: 'JON', orders: 1, gross: '5.00', fees: '0.00', net: '5.00' },
      { status: 'delivered', currency: 'EUR', orders: 1, gross: '8.00', fees: '1.00', net: '7.00' },
    ]);
    assert.equal(folded.mixedCurrency, true);
    assert.equal(folded.primaryCurrency, 'JON');
    assert.equal(folded.grossRevenue, '30.00');
    assert.equal(folded.platformFees, '3.00');
    assert.equal(folded.netRevenue, '27.00');
    assert.equal(folded.recognizedOrders, 3);
    assert.equal(folded.completedOrders, 2);
    assert.equal(folded.refundedOrders, 1);
    assert.equal(folded.cancelledOrders, 1);
    assert.equal(folded.averageOrderValue, '10.00');
    const eur = folded.byCurrency.find((row) => row.currency === 'EUR');
    assert.equal(eur.grossRevenue, '8.00');
    assert.notEqual(Number(folded.grossRevenue) + Number(eur.grossRevenue), Number(folded.grossRevenue));
  });

  it('folds wallet movement without inventing a balance', () => {
    const activity = foldWalletRows([
      { type: 'purchase', count: 2, total: '50.00' },
      { type: 'spend', count: 3, total: '12.50' },
      { type: 'sale', count: 1, total: '9.00' },
      { type: 'refund', count: 1, total: '4.00' },
    ]);
    assert.equal(activity.purchased, '50.00');
    assert.equal(activity.spent, '12.50');
    assert.equal(activity.received, '9.00');
    assert.equal(activity.refunds, '4.00');
    assert.equal(activity.transactionCount, 7);
    assert.equal(activity.balanceIncluded, false);
    assert.equal(Object.prototype.hasOwnProperty.call(activity, 'balance'), false);
  });
});

describe('comparison, club results, and role modules', () => {
  it('compares the same match metrics on both sides', () => {
    const result = comparison({
      kind: 'player',
      left: { id: 1, name: 'A', stats: { goals: 2, assists: 1, appearances: 3, rating: 7.5 } },
      right: { id: 2, name: 'B', stats: { goals: 4, assists: 0, appearances: 3, rating: 6 } },
    });
    assert.equal(result.metricSet, 'match_performance');
    const goals = result.metrics.find((row) => row.key === 'goals');
    assert.equal(goals.left, 2);
    assert.equal(goals.right, 4);
    assert.equal(goals.unit, 'goals');
    assert.equal(result.metrics.every((row) => row.comparable), true);
  });

  it('reads club results from match scores', () => {
    assert.equal(clubMatchResult({ status: 'finished', homeUserId: 1, awayUserId: 2, scoreHome: 3, scoreAway: 1 }, 1), 'win');
    assert.equal(clubMatchResult({ status: 'finished', homeUserId: 1, awayUserId: 2, scoreHome: 1, scoreAway: 1 }, 2), 'draw');
    assert.equal(clubMatchResult({ status: 'scheduled', homeUserId: 1, awayUserId: 2, scoreHome: null, scoreAway: null }, 1), null);
  });

  it('shows scouting to scouts and marketplace only when the user sells', () => {
    assert.ok(modulesFor('athlete', { hasProducts: false }).includes('player'));
    assert.equal(modulesFor('athlete', { hasProducts: false }).includes('marketplace'), false);
    assert.ok(modulesFor('athlete', { hasProducts: true }).includes('marketplace'));
    assert.ok(modulesFor('scout', { hasProducts: false }).includes('scouting'));
    assert.ok(modulesFor('club', { hasProducts: false }).includes('club'));
    assert.equal(modulesFor('scout', { hasProducts: false }).includes('player'), false);
  });
});

describe('metric sources', () => {
  it('documents one source for goals, standings, orders, and the ledger', () => {
    assert.match(METRIC_SOURCES.playerGoals, /MatchScorer/);
    assert.match(METRIC_SOURCES.leaguePosition, /getStandings/);
    assert.equal(METRIC_SOURCES.orders, 'Orders');
    assert.match(METRIC_SOURCES.walletBalance, /ledger/i);
    assert.match(METRIC_SOURCES.videoViews, /Video\.views/);
  });
});
