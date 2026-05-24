const { User, Profile, Achievement, Badge, Reward, UserAchievement, UserBadge, UserReward, Post, Like, Comment, Subscription, Match } = require('../models');
const sequelize = require('sequelize');

// Award points and level up; emits xp:earned to user's socket room when available.
async function awardPoints(userId, points, reason = '') {
  const user = await User.findByPk(userId);
  if (!user) return null;

  const oldLevel = Number(user.level) || 1;
  user.points = (Number(user.points) || 0) + (Number(points) || 0);
  const newLevel = Math.floor(user.points / 1000) + 1;
  let levelUp = null;
  if (newLevel > oldLevel) {
    user.level = newLevel;
    levelUp = { oldLevel, newLevel };
  }
  await user.save();

  const payload = { xp: Number(points) || 0, reason: reason || '', levelUp };
  try {
    const socketUtil = require('../utils/socket');
    const io = socketUtil.getIo();
    if (io) {
      io.to(String(userId)).emit('xp:earned', payload);
    }
  } catch (emitErr) {
    console.warn('xp:earned emit failed:', emitErr?.message);
  }

  return payload;
}

// Get user gamification status and auto-award achievements/badges
async function getUserGamification(req, res) {
  try {
    console.log('DEBUG req.user:', req.user);
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.id;
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const commentsCount = await Comment.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });

    // Streak fitore (5 fitore radhazi)
    const matches = await Match.findAll({
      where: {
        status: 'finished',
        [sequelize.Op.or]: [
          { homeUserId: userId },
          { awayUserId: userId }
        ]
      },
      order: [['matchDate', 'DESC'], ['id', 'DESC']],
    });

    const profileRow = await Profile.findOne({ where: { userId } });
    const pStats =
      profileRow && profileRow.stats && typeof profileRow.stats === 'object' && !Array.isArray(profileRow.stats)
        ? profileRow.stats
        : {};

    const participationCount = matches.length;
    let goalsFromMatches = 0;
    let goalsInMatchMax = 0;
    let cleanSheetCount = 0;
    for (const m of matches) {
      const isHome = m.homeUserId === userId;
      const userScore = isHome ? Number(m.scoreHome || 0) : Number(m.scoreAway || 0);
      const oppScore = isHome ? Number(m.scoreAway || 0) : Number(m.scoreHome || 0);
      goalsFromMatches += userScore;
      if (userScore > goalsInMatchMax) goalsInMatchMax = userScore;
      if (oppScore === 0 && userScore > 0) cleanSheetCount += 1;
    }

    const numStat = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const goals =
      pStats.goals !== undefined && pStats.goals !== null && String(pStats.goals).trim() !== ''
        ? numStat(pStats.goals, goalsFromMatches)
        : goalsFromMatches;
    const assists =
      pStats.assists !== undefined && pStats.assists !== null && String(pStats.assists).trim() !== ''
        ? numStat(pStats.assists, 0)
        : matches.reduce((sum, m) => sum + numStat(m.assists, 0), 0);
    const wins = matches.filter(m =>
      (m.homeUserId === userId && m.scoreHome > m.scoreAway) ||
      (m.awayUserId === userId && m.scoreAway > m.scoreHome)
    );
    let streak = 0;
    for (const match of wins) {
      const idx = matches.findIndex(m => m.id === match.id);
      if (idx !== streak) break;
      streak++;
    }
    if (streak >= 5) {
      const badgeName = '5 Wins Streak';
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: 'Arritje për 5 fitore radhazi në ndeshje!',
          icon: '🔥',
          rarity: 'epic',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: 'Arritje për 5 fitore radhazi në ndeshje!',
          icon: '🔥',
          criteria: { type: 'streak', value: 5, badgeId: badge.id },
        });
      }
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement) {
        await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({ userId, badgeId: badge.id, earnedAt: new Date() });
        }
      }
    }

    // Milestones
    const participationMilestones = [10, 50, 100, 500, 1000];
    const likeMilestones = [100, 1000, 10000, 100000, 1000000];
    for (const milestone of participationMilestones) {
      const badgeName = `Participation ${milestone}`;
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
          icon: '⚽',
          rarity: 'rare',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
          icon: '⚽',
          criteria: { type: 'participation', value: milestone, badgeId: badge.id },
        });
      }
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && participationCount >= milestone) {
        await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({ userId, badgeId: badge.id, earnedAt: new Date() });
        }
      }
    }
    for (const milestone of likeMilestones) {
      const badgeName = `Likes ${milestone}`;
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          rarity: 'rare',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          criteria: { type: 'likes', value: milestone, badgeId: badge.id },
        });
      }
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && likesCount >= milestone) {
        await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({ userId, badgeId: badge.id, earnedAt: new Date() });
        }
      }
    }
    const achievementsList = await Achievement.findAll();
    for (const achievement of achievementsList) {
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && achievement.criteria) {
        let unlocked = false;
        const criteria = achievement.criteria;
        switch (criteria.type) {
          case 'posts': unlocked = postsCount >= criteria.value; break;
          case 'followers': unlocked = followersCount >= criteria.value; break;
          case 'likes': unlocked = likesCount >= criteria.value; break;
          case 'comments': unlocked = commentsCount >= criteria.value; break;
          case 'level': unlocked = user.level >= criteria.value; break;
          case 'points': unlocked = user.points >= criteria.value; break;
          case 'goals': unlocked = goals >= criteria.value; break;
          case 'assists': unlocked = assists >= criteria.value; break;
          case 'matches': unlocked = participationCount >= criteria.value; break;
          case 'participation': unlocked = participationCount >= criteria.value; break;
          case 'streak': unlocked = streak >= criteria.value; break;
          case 'goalsInMatch': unlocked = goalsInMatchMax >= criteria.value; break;
          case 'cleanSheet': unlocked = cleanSheetCount >= criteria.value; break;
        }
        if (unlocked) {
          await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
          if (criteria.badgeId) {
            const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: criteria.badgeId } });
            if (!hasBadge) {
              await UserBadge.create({ userId, badgeId: criteria.badgeId, earnedAt: new Date() });
            }
          }
        }
      }
    }
    // Achievements
    const achievementsRaw = await Achievement.findAll();
    const userAchievements = await UserAchievement.findAll({ where: { userId }, attributes: ['achievementId', 'unlockedAt'] });
    const unlockedMap = {};
    userAchievements.forEach(ua => { unlockedMap[ua.achievementId] = ua.unlockedAt; });
    const stats = {
      posts: postsCount,
      followers: followersCount,
      likes: likesCount,
      comments: commentsCount,
      level: user.level,
      points: user.points,
      goals,
      goalsInMatch: goalsInMatchMax,
      assists,
      matches: participationCount,
      participation: participationCount,
      winStreak: streak,
      streak,
      blocks: numStat(pStats.blocks, 0),
      keyPasses: numStat(pStats.keyPasses, 0),
      captain: numStat(pStats.captain, 0),
      cleanSheet: cleanSheetCount,
    };
    const achievements = achievementsRaw.map(achievement => {
      const unlocked = !!unlockedMap[achievement.id];
      let progress = 0;
      if (!unlocked && achievement.criteria) {
        let criteria = achievement.criteria;
        // Nëse është string, parse JSON
        if (typeof criteria === 'string') {
          try {
            criteria = JSON.parse(criteria);
          } catch (e) {
            criteria = {};
          }
        }
        let current = 0;
        // Nëse ka 'type', përdor atë
        if (criteria.type && stats[criteria.type] !== undefined) {
          current = stats[criteria.type];
          if (criteria.value) {
            progress = Math.min(100, Math.round((current / criteria.value) * 100));
          }
        } else {
          // Nëse ka çelësa custom si 'goals', 'assists', etj.
          for (const key in criteria) {
            if (key !== 'badgeId' && stats[key] !== undefined && typeof criteria[key] === 'number') {
              current = stats[key];
              progress = Math.min(100, Math.round((current / criteria[key]) * 100));
              break;
            }
          }
        }
        // Nëse ende është 0, vendos 0
        if (!progress || isNaN(progress)) progress = 0;
      }
      return { ...achievement.toJSON(), unlocked, unlockedAt: unlockedMap[achievement.id] || null, progress };
    });

    // Badges
    const badgesRaw = await Badge.findAll({
      order: [
        [sequelize.literal(`CASE WHEN rarity = 'legendary' THEN 1 WHEN rarity = 'epic' THEN 2 WHEN rarity = 'rare' THEN 3 ELSE 4 END`), 'ASC'],
        ['name', 'ASC'],
      ],
    });
    const userBadges = await UserBadge.findAll({ where: { userId }, attributes: ['badgeId', 'earnedAt'] });
    const earnedMap = {};
    userBadges.forEach(ub => { earnedMap[ub.badgeId] = ub.earnedAt; });
    const badges = badgesRaw.map(badge => ({ ...badge.toJSON(), earned: !!earnedMap[badge.id], earnedAt: earnedMap[badge.id] || null }));

    console.log('DB User:', user);
    console.log('DB Achievements:', achievements);
    console.log('DB Badges:', badges);
    console.log('DB Stats:', { postsCount, followersCount, likesCount, commentsCount });
    res.json({
      user: user,
      achievements,
      badges,
      postsCount,
      followersCount,
      likesCount,
      commentsCount
    });
  } catch (error) {
    console.error('Get user gamification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get achievements with progress
async function getAchievements(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const achievementsRaw = await Achievement.findAll({ order: [['points', 'DESC']] });
    const userAchievements = await UserAchievement.findAll({ where: { userId }, attributes: ['achievementId', 'unlockedAt'] });
    const unlockedMap = {};
    userAchievements.forEach(ua => { unlockedMap[ua.achievementId] = ua.unlockedAt; });
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const commentsCount = await Comment.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });
    const achievementsWithProgress = achievementsRaw.map(achievement => {
      const unlocked = !!unlockedMap[achievement.id];
      let progress = 0;
      if (!unlocked && achievement.criteria) {
        const criteria = achievement.criteria;
        let current = 0;
        switch (criteria.type) {
          case 'posts': current = postsCount; break;
          case 'followers': current = followersCount; break;
          case 'likes': current = likesCount; break;
          case 'comments': current = commentsCount; break;
          case 'level': current = user.level; break;
          case 'points': current = user.points; break;
        }
        progress = Math.min(100, Math.round((current / criteria.value) * 100));
      }
      return { ...achievement.toJSON(), unlocked, unlockedAt: unlockedMap[achievement.id] || null, progress };
    });
    console.log('DB Achievements:', achievementsWithProgress);
    res.json(achievementsWithProgress);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get badges with status
async function getBadges(req, res) {
  try {
    const userId = req.user.id;
    const badges = await Badge.findAll({
      order: [
        [sequelize.literal(`CASE WHEN rarity = 'legendary' THEN 1 WHEN rarity = 'epic' THEN 2 WHEN rarity = 'rare' THEN 3 ELSE 4 END`), 'ASC'],
        ['name', 'ASC'],
      ],
    });
    const userBadges = await UserBadge.findAll({ where: { userId }, attributes: ['badgeId', 'earnedAt'] });
    const earnedMap = {};
    userBadges.forEach(ub => { earnedMap[ub.badgeId] = ub.earnedAt; });
    const badgesWithStatus = badges.map(badge => ({ ...badge.toJSON(), earned: !!earnedMap[badge.id], earnedAt: earnedMap[badge.id] || null }));
    console.log('DB Badges:', badgesWithStatus);
    res.json(badgesWithStatus);
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Claim reward
async function claimReward(req, res) {
  try {
    const { rewardId } = req.params;
    const userId = req.user.id;
    const reward = await Reward.findByPk(rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    const claimed = await UserReward.findOne({ where: { userId, rewardId } });
    if (claimed) return res.status(400).json({ error: 'Reward already claimed' });
    if (reward.badgeId) {
      const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: reward.badgeId } });
      if (!hasBadge) return res.status(403).json({ error: 'Badge required to claim this reward' });
    }
    await UserReward.create({ userId, rewardId, claimedAt: new Date() });
    if (reward.value) {
      await awardPoints(userId, reward.value, 'Reward claimed');
    }
    res.json({ msg: 'Reward claimed successfully' });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  awardPoints,
  getUserGamification,
  getAchievements,
  getBadges,
  claimReward
};
