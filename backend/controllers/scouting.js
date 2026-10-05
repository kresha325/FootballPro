const Profile = require('../models/Profile');
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const Like = require('../models/Like');
const { Op } = require('sequelize');
const workspace = require('../services/scoutingWorkspace');

async function sendWorkspace(res, work) {
  try {
    const result = await work;
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('scouting workspace:', err);
    return res.status(500).json({ msg: 'Gabim në server' });
  }
}

exports.getRecommendations = (req, res) => sendWorkspace(res, workspace.recommendations(req.user, req.query));
exports.getPlayers = (req, res) => sendWorkspace(res, workspace.discover(req.user, req.query));
exports.getPlayer = (req, res) => sendWorkspace(res, workspace.playerCard(req.user, req.params.id));
exports.getDashboard = (req, res) => sendWorkspace(res, workspace.dashboard(req.user));
exports.getMeta = (_req, res) => res.json(workspace.meta());
exports.getPreferences = (req, res) => sendWorkspace(res, workspace.getPreferences(req.user));
exports.savePreferences = (req, res) => sendWorkspace(res, workspace.savePreferences(req.user, req.body));
exports.listShortlist = (req, res) => sendWorkspace(res, workspace.listShortlist(req.user, req.query));
exports.addShortlist = (req, res) => sendWorkspace(res, workspace.addShortlist(req.user, req.body));
exports.updateShortlist = (req, res) => sendWorkspace(res, workspace.updateShortlist(req.user, req.params.id, req.body));
exports.removeShortlist = (req, res) => sendWorkspace(res, workspace.removeShortlist(req.user, req.params.id));
exports.listWatchlist = (req, res) => sendWorkspace(res, workspace.listWatchlist(req.user, req.query));
exports.addWatchlist = (req, res) => sendWorkspace(res, workspace.addWatchlist(req.user, req.body));
exports.removeWatchlist = (req, res) => sendWorkspace(res, workspace.removeWatchlist(req.user, req.params.id));
exports.listReports = (req, res) => sendWorkspace(res, workspace.listReports(req.user, req.query));
exports.createReport = (req, res) => sendWorkspace(res, workspace.createReport(req.user, req.body));
exports.updateReport = (req, res) => sendWorkspace(res, workspace.updateReport(req.user, req.params.id, req.body));
exports.removeReport = (req, res) => sendWorkspace(res, workspace.removeReport(req.user, req.params.id));

const SCORE_WEIGHTS = {
  goals: 35,
  assists: 25,
  likes: 20,
  followers: 20,
};

const AGE_GROUP_PRESETS = ['U13', 'U15', 'U17', 'U19', 'Senior'];

function normalizeAgeGroup(value) {
  if (!value || typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'SENIOR') return 'Senior';
  if (normalized.startsWith('U')) {
    const digits = normalized.replace(/[^\d]/g, '');
    return digits ? `U${digits}` : normalized;
  }
  return value.trim();
}

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 10) / 10;
}

async function getPlayerMetrics(playerId) {
  const profile = await Profile.findOne({ where: { userId: playerId } });
  if (!profile) return null;

  const [likesCount, followersCount] = await Promise.all([
    Like.count({
      include: [{
        model: Post,
        where: { userId: playerId },
        attributes: [],
        required: true,
      }],
    }),
    Follow.count({
      where: {
        followingId: playerId,
        status: 'accepted',
      },
    }),
  ]);

  let official = { goals: 0, assists: 0, appearances: 0 };
  try {
    const { loadOfficialTotalsForUsers } = require('../utils/playerProfileCv');
    const map = await loadOfficialTotalsForUsers([playerId]);
    official = map[Number(playerId)] || official;
  } catch (err) {
    console.warn('compare official stats:', err?.message || err);
  }
  return {
    profile,
    goals: toSafeNumber(official.goals),
    assists: toSafeNumber(official.assists),
    likes: toSafeNumber(likesCount),
    followers: toSafeNumber(followersCount),
  };
}

function createScoreBreakdown(playerMetrics, maxValues) {
  const breakdown = {};
  let totalScore = 0;

  for (const key of Object.keys(SCORE_WEIGHTS)) {
    const raw = toSafeNumber(playerMetrics[key]);
    const max = toSafeNumber(maxValues[key]);
    const normalized = max > 0 ? raw / max : 0;
    const weighted = normalized * SCORE_WEIGHTS[key];
    const safeWeighted = clampScore(weighted);

    breakdown[key] = {
      rawValue: raw,
      normalized: Math.round(normalized * 1000) / 1000,
      weight: SCORE_WEIGHTS[key],
      weightedScore: safeWeighted,
    };
    totalScore += safeWeighted;
  }

  return {
    breakdown,
    score: clampScore(totalScore),
  };
}

function metricWinner(a, b, key) {
  if (a[key] > b[key]) return 'A';
  if (b[key] > a[key]) return 'B';
  return 'draw';
}

async function getFollowersAthleteCandidates(currentUserId, ageGroup) {
  const followRows = await Follow.findAll({
    where: {
      followerId: currentUserId,
      status: 'accepted',
    },
    attributes: ['followingId'],
  });

  const followedIds = [...new Set(followRows.map((row) => Number(row.followingId)).filter(Boolean))];
  if (!followedIds.length) return [];

  const profileWhere = {};
  if (ageGroup) {
    profileWhere.ageGroup = ageGroup;
  }

  const users = await User.findAll({
    where: {
      id: { [Op.in]: followedIds },
      role: 'athlete',
    },
    attributes: ['id', 'firstName', 'lastName'],
    include: [{
      model: Profile,
      where: profileWhere,
      required: true,
      attributes: ['profilePhoto', 'position', 'age', 'ageGroup', 'stats', 'club'],
    }],
    order: [['firstName', 'ASC']],
  });

  return users.map((u) => ({
    id: u.id,
    fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || `Player ${u.id}`,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    profilePhoto: u.Profile?.profilePhoto || null,
    position: u.Profile?.position || null,
    age: u.Profile?.age || null,
    ageGroup: normalizeAgeGroup(u.Profile?.ageGroup) || null,
    club: u.Profile?.club || null,
    stats: u.Profile?.stats || {},
  }));
}

exports.getCompareCandidates = async (req, res) => {
  try {
    const source = String(req.query.source || 'followers').toLowerCase();
    const ageGroup = normalizeAgeGroup(req.query.ageGroup);

    if (source !== 'followers') {
      return res.status(400).json({ msg: 'Burim i pambështetur. Në MVP lejohet vetëm source=followers.' });
    }

    const candidates = await getFollowersAthleteCandidates(req.user.id, ageGroup || '');

    return res.json({
      source,
      filters: {
        ageGroup: ageGroup || 'all',
      },
      ageGroups: AGE_GROUP_PRESETS,
      total: candidates.length,
      candidates,
    });
  } catch (err) {
    console.error('Scouting candidates error:', err);
    return res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};

exports.comparePlayers = async (req, res) => {
  if (req.query.ids) {
    return sendWorkspace(res, workspace.comparePlayers(req.user, req.query));
  }
  try {
    const playerAId = Number(req.query.playerAId);
    const playerBId = Number(req.query.playerBId);
    const ageGroup = normalizeAgeGroup(req.query.ageGroup);

    if (!Number.isFinite(playerAId) || !Number.isFinite(playerBId)) {
      return res.status(400).json({ msg: 'playerAId dhe playerBId duhet të jenë vlera numerike të detyrueshme.' });
    }
    if (playerAId === playerBId) {
      return res.status(400).json({ msg: 'Ju lutem zgjidhni dy lojtarë të ndryshëm.' });
    }

    const candidates = await getFollowersAthleteCandidates(req.user.id, ageGroup || '');
    const allowedIds = new Set(candidates.map((c) => c.id));
    if (!allowedIds.has(playerAId) || !allowedIds.has(playerBId)) {
      return res.status(403).json({ msg: 'Lojtarët e zgjedhur duhet të jenë atletë që i ndiqni (sipas filtrit aktual të grupmoshës).' });
    }

    const [playerA, playerB] = await Promise.all([
      User.findOne({
        where: { id: playerAId, role: 'athlete' },
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, required: true, attributes: ['profilePhoto', 'position', 'age', 'ageGroup', 'club', 'stats'] }],
      }),
      User.findOne({
        where: { id: playerBId, role: 'athlete' },
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, required: true, attributes: ['profilePhoto', 'position', 'age', 'ageGroup', 'club', 'stats'] }],
      }),
    ]);

    if (!playerA || !playerB) {
      return res.status(404).json({ msg: 'Njëri ose të dy lojtarët nuk u gjetën.' });
    }

    const [metricsA, metricsB] = await Promise.all([
      getPlayerMetrics(playerAId),
      getPlayerMetrics(playerBId),
    ]);
    if (!metricsA || !metricsB) {
      return res.status(404).json({ msg: 'Mungojnë metrikat e profilit të lojtarit.' });
    }

    const maxValues = {
      goals: Math.max(metricsA.goals, metricsB.goals, 1),
      assists: Math.max(metricsA.assists, metricsB.assists, 1),
      likes: Math.max(metricsA.likes, metricsB.likes, 1),
      followers: Math.max(metricsA.followers, metricsB.followers, 1),
    };

    const scoreA = createScoreBreakdown(metricsA, maxValues);
    const scoreB = createScoreBreakdown(metricsB, maxValues);

    const metricWinners = {
      goals: metricWinner(metricsA, metricsB, 'goals'),
      assists: metricWinner(metricsA, metricsB, 'assists'),
      likes: metricWinner(metricsA, metricsB, 'likes'),
      followers: metricWinner(metricsA, metricsB, 'followers'),
    };

    const scoreDifference = Math.round(Math.abs(scoreA.score - scoreB.score) * 10) / 10;

    return res.json({
      filters: {
        source: 'followers',
        ageGroup: ageGroup || 'all',
      },
      metricWeights: SCORE_WEIGHTS,
      players: {
        A: {
          id: playerA.id,
          fullName: `${playerA.firstName || ''} ${playerA.lastName || ''}`.trim() || `Player ${playerA.id}`,
          profilePhoto: playerA.Profile?.profilePhoto || null,
          position: playerA.Profile?.position || null,
          club: playerA.Profile?.club || null,
          age: playerA.Profile?.age || null,
          ageGroup: normalizeAgeGroup(playerA.Profile?.ageGroup) || null,
          metrics: {
            goals: metricsA.goals,
            assists: metricsA.assists,
            likes: metricsA.likes,
            followers: metricsA.followers,
          },
          score: scoreA.score,
          breakdown: scoreA.breakdown,
        },
        B: {
          id: playerB.id,
          fullName: `${playerB.firstName || ''} ${playerB.lastName || ''}`.trim() || `Player ${playerB.id}`,
          profilePhoto: playerB.Profile?.profilePhoto || null,
          position: playerB.Profile?.position || null,
          club: playerB.Profile?.club || null,
          age: playerB.Profile?.age || null,
          ageGroup: normalizeAgeGroup(playerB.Profile?.ageGroup) || null,
          metrics: {
            goals: metricsB.goals,
            assists: metricsB.assists,
            likes: metricsB.likes,
            followers: metricsB.followers,
          },
          score: scoreB.score,
          breakdown: scoreB.breakdown,
        },
      },
      comparison: {
        winner: scoreA.score === scoreB.score ? 'draw' : (scoreA.score > scoreB.score ? 'A' : 'B'),
        scoreDifference,
        metricWinners,
      },
    });
  } catch (err) {
    console.error('Scouting compare error:', err);
    return res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};