const sequelize = require('./config/database');
const User = require('./models/User');
const Profile = require('./models/Profile');

async function deleteAllUsers() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Use CASCADE to delete all related records automatically
    await sequelize.query('TRUNCATE TABLE "Users" CASCADE');
    console.log('✅ All users and related data deleted successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
    process.exit(1);
  }
}

deleteAllUsers();
