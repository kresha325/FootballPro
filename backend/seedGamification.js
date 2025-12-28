const sequelize = require('./config/database');
const Achievement = require('./models/Achievement');
const Badge = require('./models/Badge');

const achievements = [
  {
    name: 'First Steps',
    description: 'Create your first post',
    icon: '🎯',
    points: 10,
    experience: 10,
    criteria: { type: 'posts', count: 1 },
  },
  {
    name: 'Content Creator',
    description: 'Create 10 posts',
    icon: '✍️',
    points: 50,
    experience: 50,
    criteria: { type: 'posts', count: 10 },
  },
  {
    name: 'Prolific Writer',
    description: 'Create 50 posts',
    icon: '📝',
    points: 200,
    experience: 200,
    criteria: { type: 'posts', count: 50 },
  },
  {
    name: 'Content King',
    description: 'Create 100 posts',
    icon: '👑',
    points: 500,
    experience: 500,
    criteria: { type: 'posts', count: 100 },
  },
  {
    name: 'Popular',
    description: 'Gain 10 followers',
    icon: '⭐',
    points: 30,
    experience: 30,
    criteria: { type: 'followers', count: 10 },
  },
  {
    name: 'Rising Star',
    description: 'Gain 50 followers',
    icon: '🌟',
    points: 100,
    experience: 100,
    criteria: { type: 'followers', count: 50 },
  },
  {
    name: 'Influencer',
    description: 'Gain 100 followers',
    icon: '💫',
    points: 250,
    experience: 250,
    criteria: { type: 'followers', count: 100 },
  },
  {
    name: 'Celebrity',
    description: 'Gain 500 followers',
    icon: '🏆',
    points: 1000,
    experience: 1000,
    criteria: { type: 'followers', count: 500 },
  },
  {
    name: 'Well Liked',
    description: 'Receive 50 likes on your posts',
    icon: '❤️',
    points: 50,
    experience: 50,
    criteria: { type: 'likes', count: 50 },
  },
  {
    name: 'Beloved',
    description: 'Receive 200 likes on your posts',
    icon: '💖',
    points: 150,
    experience: 150,
    criteria: { type: 'likes', count: 200 },
  },
  {
    name: 'Engagement Master',
    description: 'Receive 100 comments on your posts',
    icon: '💬',
    points: 200,
    experience: 200,
    criteria: { type: 'comments', count: 100 },
  },
  {
    name: 'Level Up!',
    description: 'Reach level 5',
    icon: '🎊',
    points: 100,
    experience: 100,
    criteria: { type: 'level', level: 5 },
  },
  {
    name: 'Experienced',
    description: 'Reach level 10',
    icon: '🎓',
    points: 250,
    experience: 250,
    criteria: { type: 'level', level: 10 },
  },
  {
    name: 'Master',
    description: 'Reach level 25',
    icon: '🏅',
    points: 500,
    experience: 500,
    criteria: { type: 'level', level: 25 },
  },
  {
    name: 'Legend',
    description: 'Reach level 50',
    icon: '👑',
    points: 1000,
    experience: 1000,
    criteria: { type: 'level', level: 50 },
  },
];

const badges = [
  {
    name: 'Newcomer',
    description: 'Joined the platform',
    icon: '🆕',
    rarity: 'common',
  },
  {
    name: 'Verified',
    description: 'Verified account',
    icon: '✅',
    rarity: 'rare',
  },
  {
    name: 'Premium Member',
    description: 'Premium subscription active',
    icon: '⭐',
    rarity: 'epic',
  },
  {
    name: 'Early Adopter',
    description: 'One of the first 100 users',
    icon: '🚀',
    rarity: 'legendary',
  },
  {
    name: 'Athlete',
    description: 'Registered as an athlete',
    icon: '⚽',
    rarity: 'common',
  },
  {
    name: 'Coach',
    description: 'Registered as a coach',
    icon: '🏋️',
    rarity: 'common',
  },
  {
    name: 'Scout',
    description: 'Registered as a scout',
    icon: '🔍',
    rarity: 'common',
  },
  {
    name: 'Tournament Winner',
    description: 'Won a tournament',
    icon: '🏆',
    rarity: 'epic',
  },
  {
    name: 'Tournament Champion',
    description: 'Won 5 tournaments',
    icon: '👑',
    rarity: 'legendary',
  },
  {
    name: 'Social Butterfly',
    description: 'Active in messaging',
    icon: '💬',
    rarity: 'rare',
  },
  {
    name: 'Top Contributor',
    description: 'High quality content creator',
    icon: '🌟',
    rarity: 'epic',
  },
  {
    name: 'Community Leader',
    description: 'Helps and guides others',
    icon: '🎖️',
    rarity: 'legendary',
  },
];

async function seedGamification() {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');

    // Clear existing data
    await Achievement.destroy({ where: {} });
    await Badge.destroy({ where: {} });
    console.log('Cleared existing gamification data');

    // Seed achievements
    await Achievement.bulkCreate(achievements);
    console.log(`✅ Seeded ${achievements.length} achievements`);

    // Seed badges
    await Badge.bulkCreate(badges);
    console.log(`✅ Seeded ${badges.length} badges`);

    console.log('Gamification seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedGamification();
