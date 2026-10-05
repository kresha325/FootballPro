'use strict';

const { METRIC_SOURCES, ENGAGEMENT_RATE_FORMULA, parseRange } = require('../services/analytics/formulas');
const { personalDashboard, SCOUT_ROLES } = require('../services/analytics/dashboard');
const { playerAnalytics } = require('../services/analytics/player');
const { clubAnalytics, assertClubAccess } = require('../services/analytics/club');
const { competitionAnalytics } = require('../services/analytics/competition');
const { scoutAnalytics, playerScoutingInterest } = require('../services/analytics/scouting');
const { marketplaceAnalytics } = require('../services/analytics/marketplace');
const { walletAnalytics } = require('../services/analytics/wallet');
const { videoAnalytics } = require('../services/analytics/video');
const { socialTotals, followerSeries, engagementSeries } = require('../services/analytics/social');
const { comparison } = require('../services/analytics/compare');
const { hasTier } = require('../utils/subscriptionAccess');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ msg: status >= 500 ? 'Server error' : err.message });
}

function rangeFrom(req) {
  return parseRange(req.query);
}

function filtersFrom(req) {
  const range = rangeFrom(req);
  return {
    ...range,
    season: req.query.season || (range.key === 'season' ? range.season : null),
    competitionId: req.query.competitionId || null,
    clubId: req.query.clubId || null,
    from: req.query.season ? null : range.from,
    to: req.query.season ? null : range.to,
    label: req.query.season ? `Season ${req.query.season}` : range.label,
  };
}

async function home(req, res) {
  try {
    res.json(await personalDashboard(req.user, filtersFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function player(req, res) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) throw fail(400, 'Invalid player id.');
    const data = await playerAnalytics(userId, filtersFrom(req));
    const own = Number(req.user.id) === userId;
    if (!own) {
      data.achievements = null;
    }
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
}

async function club(req, res) {
  try {
    const clubId = Number(req.params.clubId);
    if (!Number.isFinite(clubId) || clubId <= 0) throw fail(400, 'Invalid club id.');
    const allowed = await assertClubAccess(req.user, clubId);
    if (!allowed) throw fail(403, 'Club analytics are visible to the club and its staff.');
    res.json(await clubAnalytics(clubId, filtersFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function competition(req, res) {
  try {
    res.json(await competitionAnalytics(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
}

async function scouting(req, res) {
  try {
    if (!SCOUT_ROLES.has(String(req.user.role || '').toLowerCase())) {
      throw fail(403, 'Scouting analytics are available to scouts, clubs, and managers.');
    }
    res.json(await scoutAnalytics(req.user.id, rangeFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function scoutingPlayer(req, res) {
  try {
    const playerId = Number(req.params.userId);
    if (Number(req.user.id) !== playerId) {
      throw fail(403, 'Scouting interest is visible only to the player.');
    }
    res.json(await playerScoutingInterest(playerId, rangeFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function marketplace(req, res) {
  try {
    res.json(await marketplaceAnalytics(req.user.id, rangeFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function wallet(req, res) {
  try {
    res.json(await walletAnalytics(req.user.id, rangeFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function video(req, res) {
  try {
    res.json(await videoAnalytics(req.user.id, rangeFrom(req)));
  } catch (err) {
    sendError(res, err);
  }
}

async function compare(req, res) {
  try {
    const kind = String(req.query.kind || 'player');
    if (kind === 'player') {
      const a = Number(req.query.a);
      const b = Number(req.query.b);
      if (!a || !b) throw fail(400, 'Player comparison needs a and b.');
      const filters = filtersFrom(req);
      const [left, right] = await Promise.all([playerAnalytics(a, filters), playerAnalytics(b, filters)]);
      return res.json(comparison({
        kind: 'player',
        left: { id: left.player.id, name: left.player.name, stats: left.window },
        right: { id: right.player.id, name: right.player.name, stats: right.window },
      }));
    }
    if (kind === 'season') {
      const userId = Number(req.query.userId || req.user.id);
      if (!req.query.seasonA || !req.query.seasonB) throw fail(400, 'Season comparison needs seasonA and seasonB.');
      const [left, right] = await Promise.all([
        playerAnalytics(userId, { season: req.query.seasonA, label: req.query.seasonA, from: null, to: null }),
        playerAnalytics(userId, { season: req.query.seasonB, label: req.query.seasonB, from: null, to: null }),
      ]);
      return res.json(comparison({
        kind: 'season',
        left: { id: req.query.seasonA, name: req.query.seasonA, stats: left.window },
        right: { id: req.query.seasonB, name: req.query.seasonB, stats: right.window },
      }));
    }
    if (kind === 'competition') {
      const userId = Number(req.query.userId || req.user.id);
      if (!req.query.competitionA || !req.query.competitionB) {
        throw fail(400, 'Competition comparison needs competitionA and competitionB.');
      }
      const [left, right] = await Promise.all([
        playerAnalytics(userId, { competitionId: req.query.competitionA, label: `Competition ${req.query.competitionA}`, from: null, to: null }),
        playerAnalytics(userId, { competitionId: req.query.competitionB, label: `Competition ${req.query.competitionB}`, from: null, to: null }),
      ]);
      return res.json(comparison({
        kind: 'competition',
        left: { id: Number(req.query.competitionA), name: left.competitions[0]?.name || `Competition ${req.query.competitionA}`, stats: left.window },
        right: { id: Number(req.query.competitionB), name: right.competitions[0]?.name || `Competition ${req.query.competitionB}`, stats: right.window },
      }));
    }
    throw fail(400, 'Comparison kind must be player, season, or competition.');
  } catch (err) {
    sendError(res, err);
  }
}

async function definitions(_req, res) {
  res.json({
    engagementRate: ENGAGEMENT_RATE_FORMULA,
    sources: METRIC_SOURCES,
  });
}

async function socialSummary(req, res) {
  try {
    if (!hasTier(req.user, 'basic')) throw fail(403, 'Social analytics require Basic or Pro.');
    const range = rangeFrom(req);
    const [totals, growth, series] = await Promise.all([
      socialTotals(req.user.id, range),
      followerSeries(req.user.id, range),
      engagementSeries(req.user.id, range),
    ]);
    res.json({ totals, followerGrowth: growth, engagement: series, formula: ENGAGEMENT_RATE_FORMULA });
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = {
  home,
  player,
  club,
  competition,
  scouting,
  scoutingPlayer,
  marketplace,
  wallet,
  video,
  compare,
  definitions,
  socialSummary,
};
