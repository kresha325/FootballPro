const ScoutingRecommendation = require('../models/ScoutingRecommendation');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Post = require('../models/Post');
const { Op } = require('sequelize');

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
  let completeness = 0;
  const profileFields = ['bio', 'club', 'position', 'nationality', 'height', 'weight', 'preferredFoot'];
  profileFields.forEach(field => {
    if (playerProfile[field]) completeness++;
  });
  const completenessScore = (completeness / profileFields.length) * weights.profile;
  score += completenessScore;
  if (completeness >= 5) {
    reasons.push(`✓ ${Math.round((completeness / profileFields.length) * 100)}% complete profile`);
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
            nationality: athlete.Profile.nationality,
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