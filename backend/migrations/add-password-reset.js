const sequelize = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Running migrations...');
    
    // Add resetPasswordToken and resetPasswordExpire columns to Users table
    await sequelize.query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "resetPasswordExpire" BIGINT
    `);
    
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

module.exports = migrate;
