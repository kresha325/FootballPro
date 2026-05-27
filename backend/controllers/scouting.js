const ScoutingRecommendation = require('../models/ScoutingRecommendation');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const Like = require('../models/Like');
const { Op } = require('sequelize');
const { profileCompletenessScore, profileNationality } = require('../utils/profileFields');

// Advanced scoring algorithm with multiple factors
const calculateScore = async (playerProfile, player, scoutProfile) => {
  let score = 0;
  const reasons = [];
  const weights = {
    position: 30,      // Exact position match
    stats: 35,         // Performance metrics
    engagement: 15,    // Social media engagement
    profile: 10,       // Profile completeness
    activity: 10,      // Recent activity
  };

  // 1. Position Match (30 points max)
  if (scoutProfile.position && playerProfile.position === scoutProfile.position) {
    score += weights.position;
    reasons.push(`✓ Position: ${playerProfile.position}`);
  } else if (scoutProfile.position && playerProfile.position) {
    // Partial match for similar positions
    const similarPositions = {
      'Forward': ['Striker', 'Winger'],
      'Midfielder': ['Attacking Midfielder', 'Defensive Midfielder'],
      'Defender': ['Center Back', 'Full Back'],
    };
    for (const [key, similar] of Object.entries(similarPositions)) {
      if ((scoutProfile.position.includes(key) && similar.some(s => playerProfile.position.includes(s))) ||
          (playerProfile.position.includes(key) && similar.some(s => scoutProfile.position.includes(s)))) {
        score += weights.position * 0.5;
        reasons.push(`~ Similar position: ${playerProfile.position}`);
        break;
      }
    }
  }

  // 2. Stats Scoring (35 points max)
  if (playerProfile.stats && typeof playerProfile.stats === 'object') {
    const stats = playerProfile.stats;
    let statsScore = 0;
    
    if (stats.goals > 0) {
      const goalPoints = Math.min(stats.goals * 0.5, 15);
      statsScore += goalPoints;
      reasons.push(`⚽ ${stats.goals} goals`);
    }
    
    if (stats.assists > 0) {
      const assistPoints = Math.min(stats.assists * 0.4, 10);
      statsScore += assistPoints;
      reasons.push(`🎯 ${stats.assists} assists`);
    }
    
    if (stats.matches > 0) {
      const matchPoints = Math.min(stats.matches * 0.2, 10);
      statsScore += matchPoints;
      reasons.push(`🏆 ${stats.matches} matches`);
    }

    // Cap stats score at max weight
    score += Math.min(statsScore, weights.stats);
  }

  // 3. Engagement Score (15 points max)
  try {
    const postCount = await Post.count({ where: { userId: player.id } });
    const engagementScore = Math.min(postCount * 0.5, weights.engagement);
    score += engagementScore;
    if (postCount > 0) {
      reasons.push(`📱 ${postCount} posts`);
    }
  } catch (error) {
    console.error('Error calculating engagement:', error);
  }

  // 4. Profile Completeness (10 points max)
  const { filled: completeness, total: completenessTotal } = profileCompletenessScore(playerProfile);
  const completenessScore = (completeness / completenessTotal) * weights.profile;
  score += completenessScore;
  if (completeness >= 5) {
    reasons.push(`✓ ${Math.round((completeness / completenessTotal) * 100)}% complete profile`);
  }

  // 5. Recent Activity (10 points max)
  try {
    const recentPosts = await Post.count({
      where: {
        userId: player.id,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });
    const activityScore = Math.min(recentPosts * 2, weights.activity);
    score += activityScore;
    if (recentPosts > 0) {
      reasons.push(`🔥 ${recentPosts} recent posts`);
    }
  } catch (error) {
    console.error('Error calculating activity:', error);
  }

  // Bonus: Premium users get slight boost (5 points)
  if (player.premium) {
    score += 5;
    reasons.push('⭐ Premium member');
  }

  return {
    score: Math.round(score * 10) / 10, // Round to 1 decimal
    reasons,
    maxScore: Object.values(weights).reduce((a, b) => a + b, 0) + 5 // Total possible
  };
};

exports.getRecommendations = async (req, res) => {
  try {
    if (req.user.role !== 'scout' && req.user.role !== 'club') {
      return res.status(403).json({ msg: 'Access denied. Scout or Club role required.' });
    }

    const scoutProfile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!scoutProfile) return res.status(404).json({ msg: 'Profile not found' });

    // Get filters from query
    const { position, minScore, limit = 20 } = req.query;

    // Build where clause for athletes
    const where = { role: 'athlete' };

    // Get all athlete profiles
    const athletes = await User.findAll({
      where,
      include: [{
        model: Profile,
        where: position ? { position: { [Op.like]: `%${position}%` } } : {}
      }],
      limit: 100 // Pre-filter to 100 athletes max
    });

    const recommendations = [];

    // Calculate score for each athlete
    for (const athlete of athletes) {
      if (athlete.Profile) {
        const { score, reasons, maxScore } = await calculateScore(
          athlete.Profile,
          athlete,
          scoutProfile
        );
        
        const minScoreThreshold = minScore ? parseFloat(minScore) : 0;
        if (score >= minScoreThreshold) {
          recommendations.push({
            playerId: athlete.id,
            playerName: `${athlete.firstName} ${athlete.lastName}`,
            email: athlete.email,
            position: athlete.Profile.position,
            club: athlete.Profile.club,
            nationality: profileNationality(athlete.Profile),
            age: athlete.Profile.age || null,
            score,
            maxScore,
            percentage: Math.round((score / maxScore) * 100),
            reasons,
            profilePhoto: athlete.Profile.profilePhoto || null,
            stats: athlete.Profile.stats || {},
            premium: athlete.premium || false,
          });
        }
      }
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    // Take top N (default 20)
    const topRecommendations = recommendations.slice(0, parseInt(limit));

    res.json({
      total: recommendations.length,
      displayed: topRecommendations.length,
      recommendations: topRecommendations,
      filters: {
        position: position || 'all',
        minScore: minScore || 0,
      }
    });
  } catch (err) {
    console.error('Scouting recommendations error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

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

  const stats = profile.stats && typeof profile.stats === 'object' ? profile.stats : {};
  return {
    profile,
    goals: toSafeNumber(stats.goals),
    assists: toSafeNumber(stats.assists),
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
    attributes: ['id', 'firstName', 'lastName', 'email'],
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
    email: u.email || null,
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
      return res.status(400).json({ msg: 'Unsupported source. Only source=followers is allowed in MVP.' });
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
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.comparePlayers = async (req, res) => {
  try {
    const playerAId = Number(req.query.playerAId);
    const playerBId = Number(req.query.playerBId);
    const ageGroup = normalizeAgeGroup(req.query.ageGroup);

    if (!Number.isFinite(playerAId) || !Number.isFinite(playerBId)) {
      return res.status(400).json({ msg: 'playerAId and playerBId are required numeric values.' });
    }
    if (playerAId === playerBId) {
      return res.status(400).json({ msg: 'Please select two different players.' });
    }

    const candidates = await getFollowersAthleteCandidates(req.user.id, ageGroup || '');
    const allowedIds = new Set(candidates.map((c) => c.id));
    if (!allowedIds.has(playerAId) || !allowedIds.has(playerBId)) {
      return res.status(403).json({ msg: 'Selected players must be athlete followers (with current age-group filter).' });
    }

    const [playerA, playerB] = await Promise.all([
      User.findOne({
        where: { id: playerAId, role: 'athlete' },
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{ model: Profile, required: true, attributes: ['profilePhoto', 'position', 'age', 'ageGroup', 'club', 'stats'] }],
      }),
      User.findOne({
        where: { id: playerBId, role: 'athlete' },
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{ model: Profile, required: true, attributes: ['profilePhoto', 'position', 'age', 'ageGroup', 'club', 'stats'] }],
      }),
    ]);

    if (!playerA || !playerB) {
      return res.status(404).json({ msg: 'One or both players were not found.' });
    }

    const [metricsA, metricsB] = await Promise.all([
      getPlayerMetrics(playerAId),
      getPlayerMetrics(playerBId),
    ]);
    if (!metricsA || !metricsB) {
      return res.status(404).json({ msg: 'Missing player profile metrics.' });
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
    return res.status(500).json({ msg: 'Server error', error: err.message });
  }
};