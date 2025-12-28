const sequelize = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Creating Follows table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Follows" (
        "id" SERIAL PRIMARY KEY,
        "followerId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
        "followingId" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
        "status" VARCHAR(20) DEFAULT 'accepted',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE("followerId", "followingId")
      )
    `);
    
    console.log('✅ Follows table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
