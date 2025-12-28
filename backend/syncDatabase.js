require('dotenv').config();
const sequelize = require('./config/database');

// Import all models
const User = require('./models/User');
const Profile = require('./models/Profile');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const Like = require('./models/Like');
const Gallery = require('./models/Gallery');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const Notification = require('./models/Notification');
const Achievement = require('./models/Achievement');
const Badge = require('./models/Badge');
const Reward = require('./models/Reward');
const UserAchievement = require('./models/UserAchievement');
const UserBadge = require('./models/UserBadge');
const UserReward = require('./models/UserReward');
const Stream = require('./models/Stream');
const Tournament = require('./models/Tournament');
const Match = require('./models/Match');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Subscription = require('./models/Subscription');
const VideoCall = require('./models/VideoCall');
const ScheduledCall = require('./models/ScheduledCall');
const ScoutingRecommendation = require('./models/ScoutingRecommendation');
const Bracket = require('./models/Bracket');
const PostAnalytics = require('./models/PostAnalytics');
const ProfileView = require('./models/ProfileView');
const EngagementMetrics = require('./models/EngagementMetrics');
const Video = require('./models/Video');

console.log('🔄 Starting database sync...\n');

const syncDatabase = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.\n');

    // Sync all models with database (alter: true will update existing tables)
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
