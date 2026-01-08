const { Badge } = require('./models');

async function seedBadges() {
  const badges = [
    {
      name: 'Goal Machine',
      description: 'Score 50 goals in your career',
      icon: '⚽️',
      rarity: 'epic',
    },
    {
      name: 'Assist Master',
      description: 'Provide 30 assists',
      icon: '🅰️',
      rarity: 'rare',
    },
    {
      name: 'Clean Sheet Pro',
      description: 'Achieve 10 clean sheets as a goalkeeper',
      icon: '🧤',
      rarity: 'rare',
    },
    {
      name: 'Defensive Rock',
      description: 'Block 50 shots as a defender',
      icon: '🛡️',
      rarity: 'legendary',
    },
    {
      name: 'Captain Fantastic',
      description: 'Be captain in 20 matches',
      icon: '🪖',
      rarity: 'epic',
    },
    {
      name: 'Hat-trick Legend',
      description: 'Score 5 hat-tricks',
      icon: '🎩',
      rarity: 'legendary',
    },
    {
      name: 'Playmaker',
      description: 'Create 100 key passes',
      icon: '🎯',
      rarity: 'epic',
    },
    {
      name: 'Loyalty',
      description: 'Play 200 matches for the same club',
      icon: '💯',
      rarity: 'legendary',
    },
    {
      name: 'Debutant',
      description: 'Play your first official match',
      icon: '🆕',
      rarity: 'common',
    },
    {
      name: 'Winning Spirit',
      description: 'Win 50 matches',
      icon: '🏆',
      rarity: 'rare',
    },
  ];

  for (const badge of badges) {
    await Badge.findOrCreate({ where: { name: badge.name }, defaults: badge });
  }
  console.log('Football badges seeded!');
  process.exit();
}

seedBadges().catch(console.error);
