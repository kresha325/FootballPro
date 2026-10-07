/**
 * VARSHËM: ky skript përdor `sequelize.sync({ alter: true })` — përshtat tabela sipas modeleve.
 * Për mjedise të përbashkëta / prod / CI përdorni VETËM migracionet (`sequelize-cli db:migrate`),
 * jo këtë skript, që historia e skemës të jetë e gjurmueshme dhe e ripërsëritshme.
 */
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'syncDatabase.js refused: sequelize.sync({ alter: true }) is not allowed when NODE_ENV=production. Use migrations (npx sequelize-cli db:migrate).'
  );
}

const { assertDestructiveAllowed } = require('./utils/destructiveGuard');
assertDestructiveAllowed('syncDatabase.js');
const sequelize = require('./config/database');

// Import all models so sequelize.sync sees them.
require('./models/User');
require('./models/Profile');
require('./models/Post');
require('./models/Comment');
require('./models/Like');
require('./models/Gallery');
require('./models/Message');
require('./models/Conversation');
require('./models/Notification');
require('./models/Achievement');
require('./models/Badge');
require('./models/Reward');
require('./models/UserAchievement');
require('./models/UserBadge');
require('./models/UserReward');
require('./models/Stream');
require('./models/Tournament');
require('./models/Match');
require('./models/Product');
require('./models/Order');
require('./models/Payment');
require('./models/Subscription');
require('./models/VideoCall');
require('./models/ScheduledCall');
require('./models/ScoutingRecommendation');
require('./models/Bracket');
require('./models/PostAnalytics');
require('./models/ProfileView');
require('./models/EngagementMetrics');
require('./models/Video');
require('./models/Follow');
require('./models/Ad');
require('./models/Sponsor');

console.log('🔄 Starting database sync (alter) — vetëm për dev lokal; përndryshe migrime.\n');

const syncDatabase = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.\n');

    // Sync all models with database (alter: true will update existing tables)
    // Prefer migrations for any durable schema change.
    await sequelize.sync({ alter: true });
    
    console.log('✅ All models synchronized successfully!\n');
    
    // List all tables
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📊 Tables in database:');
    console.log('━'.repeat(50));
    results.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    console.log('━'.repeat(50));
    console.log(`\nTotal: ${results.length} tables\n`);
    
    // Check each model's table
    const models = [
      'Users', 'Profiles', 'Posts', 'Comments', 'Likes', 
      'Galleries', 'Messages', 'Conversations', 'Notifications',
      'Achievements', 'Badges', 'Rewards', 
      'UserAchievements', 'UserBadges', 'UserRewards',
      'Streams', 'Tournaments', 'Matches', 
      'Products', 'Orders', 'Payments', 'Subscriptions',
      'VideoCalls', 'ScheduledCalls', 'ScoutingRecommendations',
      'Brackets', 'PostAnalytics', 'ProfileViews', 
      'EngagementMetrics', 'Videos'
    ];
    
    console.log('✓ Checking required tables:');
    console.log('━'.repeat(50));
    
    const existingTables = results.map(r => r.table_name);
    let missingCount = 0;
    
    models.forEach(model => {
      const exists = existingTables.includes(model);
      if (exists) {
        console.log(`✅ ${model}`);
      } else {
        console.log(`❌ ${model} - MISSING!`);
        missingCount++;
      }
    });
    
    console.log('━'.repeat(50));
    
    if (missingCount === 0) {
      console.log('\n🎉 All required tables exist!\n');
    } else {
      console.log(`\n⚠️  ${missingCount} table(s) missing. Run sync again if needed.\n`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing database:', error);
    process.exit(1);
  }
};

syncDatabase();
