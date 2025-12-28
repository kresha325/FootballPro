const sequelize = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Adding location and mentions to Posts...');
    
    await sequelize.query(`
      ALTER TABLE "Posts"
      ADD COLUMN IF NOT EXISTS "location" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "mentions" JSON DEFAULT '[]'
    `);
    
    console.log('✅ Post features added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
