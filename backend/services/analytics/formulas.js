'use strict';

const { footballSeasonFromDate } = require('../../utils/footballSeason');

/**
 * Canonical engagement rate for the whole platform.
 *
 *   engagementRate = (likes + comments + shares) / impressions × 100
 *
 * impressions are deduplicated content views (post views, or video views when
 * the subject is a video). Likes, comments, and shares are the numerator.
 * Views are never part of the numerator.
 *
 * The result is a percentage rounded to 2 decimals, or null when impressions
 * are 0. Null means insufficient data. It is not rendered as zero.
 *
 * interactionsPerPost = (likes + comments + shares) / posts
 * is a different metric and must not be labeled "engagement rate".
 *
 * Video rows do not store comments or shares. Those inputs are 0 and the
 * response marks commentsTracked/sharesTracked false. The formula does not change.
 */
const ENGAGEMENT_RATE_FORMULA =
  '(likes + comments + shares) / impressions × 100';

const POST_VIEW_DEDUPE_MS = 30 * 60 * 1000;
const PROFILE_VIEW_RETENTION_DAYS = 400;
const POST_EVENT_RETENTION_DAYS = 400;
const MEDIA_EVENT_RETENTION_DAYS = 180;

const METRIC_SOURCES = {
  playerGoals: 'MatchScorer, then MatchEvent goal/penalty, then PlayerMatchStat.goals',
  playerAssists: 'MatchScorer.assistUserId, then MatchEvent assist, then PlayerMatchStat.assists',
  playerAppearances: 'Match participation (minutes, started, scorer, or card/goal event)',
  playerMinutes: 'PlayerMatchStat.minutes',
  playerCards: 'MatchEvent yellow_card/red_card, else PlayerMatchStat cards for that match',
  playerRating: 'Average of PlayerMatchStat.rating',
  leaguePosition: 'competitionService.getStandings',
  competitionGoals: 'Sum of Match.scoreHome + Match.scoreAway on finished matches',
  orders: 'Orders',
  revenue: 'Orders grossAmount/platformFeeAmount/sellerNetAmount for recognized sale statuses',
  walletBalance: 'JonCoin ledger (getCompletedLedgerBalance)',
  walletActivity: 'JonCoinTransactions grouped by type',
  videoViews: 'Video.views',
  postLikes: 'Likes',
  postComments: 'Comments',
  postShares: 'PostAnalytics type=share',
  postImpressions: 'PostAnalytics type=view (one per viewer per post per 30 minutes)',
  profileViews: 'ProfileView within retention; lifetime total from EngagementMetrics.profileViews',
  followers: 'Follows with status=accepted',
};

const RANGE_KEYS = new Set(['today', '7d', '30d', '90d', 'season', 'career', 'custom']);

function engagementRate({ likes = 0, comments = 0, shares = 0, impressions = 0 } = {}) {
  const views = Number(impressions) || 0;
  if (views <= 0) {
    return { rate: null, basis: 'impressions', formula: ENGAGEMENT_RATE_FORMULA, sufficient: false };
  }
  const actions = (Number(likes) || 0) + (Number(comments) || 0) + (Number(shares) || 0);
  const rate = Math.round((actions / views) * 10000) / 100;
  return { rate, basis: 'impressions', formula: ENGAGEMENT_RATE_FORMULA, sufficient: true };
}

function interactionsPerPost({ likes = 0, comments = 0, shares = 0, posts = 0 } = {}) {
  const count = Number(posts) || 0;
  if (count <= 0) return null;
  const actions = (Number(likes) || 0) + (Number(comments) || 0) + (Number(shares) || 0);
  return Math.round((actions / count) * 100) / 100;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function seasonBounds(season) {
  const match = String(season || '').trim().match(/^(\d{4})\/(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;
  return {
    from: new Date(Date.UTC(startYear, 7, 1)),
    to: new Date(Date.UTC(endYear, 6, 31, 23, 59, 59, 999)),
    season: `${startYear}/${endYear}`,
  };
}

function parseRange(query = {}, now = new Date()) {
  const raw = String(query.range || query.period || '30d').trim().toLowerCase();
  const alias = { '7': '7d', '30': '30d', '90': '90d', all: 'career' }[raw] || raw;
  if (!RANGE_KEYS.has(alias)) {
    const err = new Error('Date range must be today, 7d, 30d, 90d, season, career, or custom.');
    err.status = 400;
    throw err;
  }
  if (alias === 'career') {
    return { key: 'career', from: null, to: null, cumulative: true, label: 'Career' };
  }
  if (alias === 'season') {
    const season = footballSeasonFromDate(now);
    const bounds = seasonBounds(season);
    return { key: 'season', from: bounds.from, to: bounds.to, cumulative: false, label: `Season ${season}`, season };
  }
  if (alias === 'today') {
    return { key: 'today', from: startOfUtcDay(now), to: endOfUtcDay(now), cumulative: false, label: 'Today' };
  }
  if (alias === 'custom') {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      const err = new Error('Custom range needs a valid from and to.');
      err.status = 400;
      throw err;
    }
    const span = to.getTime() - from.getTime();
    if (span > 800 * 24 * 60 * 60 * 1000) {
      const err = new Error('Custom range cannot exceed 800 days.');
      err.status = 400;
      throw err;
    }
    return { key: 'custom', from, to, cumulative: false, label: 'Custom' };
  }
  const days = alias === '7d' ? 7 : alias === '90d' ? 90 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { key: alias, from, to: now, cumulative: false, label: `${days} days` };
}

function createdBetween(range) {
  if (!range?.from) return undefined;
  const { Op } = require('sequelize');
  const where = { [Op.gte]: range.from };
  if (range.to) where[Op.lte] = range.to;
  return where;
}

module.exports = {
  ENGAGEMENT_RATE_FORMULA,
  POST_VIEW_DEDUPE_MS,
  PROFILE_VIEW_RETENTION_DAYS,
  POST_EVENT_RETENTION_DAYS,
  MEDIA_EVENT_RETENTION_DAYS,
  METRIC_SOURCES,
  engagementRate,
  interactionsPerPost,
  seasonBounds,
  parseRange,
  createdBetween,
  startOfUtcDay,
};
