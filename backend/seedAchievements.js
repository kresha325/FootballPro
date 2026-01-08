
const { Achievement } = require('./models');

async function seedAchievements() {
  const achievements = [
    {
      name: 'First Goal',
      description: 'Score your first goal in a match',
      icon: '🥅',
      points: 20,
      experience: 20,
      criteria: JSON.stringify({ goals: 1 }),
      rarity: 'common',
    },
    {
      name: 'Hat-trick Hero',
      description: 'Score 3 goals in a single match',
      icon: '⚽️⚽️⚽️',
      points: 100,
      experience: 100,
      criteria: JSON.stringify({ goalsInMatch: 3 }),
      rarity: 'epic',
    },
    {
      name: 'Assist King',
      description: 'Give 10 assists',
      icon: '🅰️',
      points: 50,
      experience: 50,
      criteria: JSON.stringify({ assists: 10 }),
      rarity: 'rare',
    },
    {
      name: 'Clean Sheet',
      description: 'Finish a match as goalkeeper without conceding a goal',
      icon: '🧤',
      points: 70,
      experience: 70,
      criteria: JSON.stringify({ cleanSheet: 1 }),
      rarity: 'rare',
    },
    {
      name: 'Captain',
      description: 'Be selected as team captain in a match',
      icon: '🪖',
      points: 40,
      experience: 40,
      criteria: JSON.stringify({ captain: 1 }),
      rarity: 'common',
    },
    {
      name: 'Winning Streak',
      description: 'Win 5 matches in a row',
      icon: '🏆',
      points: 120,
      experience: 120,
      criteria: JSON.stringify({ winStreak: 5 }),
      rarity: 'epic',
    },
    {
      name: 'Defender Wall',
      description: 'Block 20 shots as a defender',
      icon: '🛡️',
      points: 60,
      experience: 60,
      criteria: JSON.stringify({ blocks: 20 }),
      rarity: 'rare',
    },
    {
      name: 'Playmaker',
      description: 'Create 30 key passes',
      icon: '🎯',
      points: 80,
      experience: 80,
      criteria: JSON.stringify({ keyPasses: 30 }),
      rarity: 'epic',
    },
    {
      name: 'Debut Match',
      description: 'Play your first official match',
      icon: '🆕',
      points: 10,
      experience: 10,
      criteria: JSON.stringify({ matches: 1 }),
      rarity: 'common',
    },
    {
      name: 'Loyal Player',
      description: 'Play 100 matches for your club',
      icon: '💯',
      points: 200,
      experience: 200,
      criteria: JSON.stringify({ matches: 100 }),
      rarity: 'legendary',
    },
  ];

  for (const ach of achievements) {
    await Achievement.findOrCreate({ where: { name: ach.name }, defaults: ach });
  }
  console.log('Football achievements seeded!');
  process.exit();
}

seedAchievements().catch(console.error);
