const sequelize = require('./config/database');

async function addColumn() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    await sequelize.query('ALTER TABLE "Galleries" ADD COLUMN IF NOT EXISTS "videoUrl" VARCHAR(255);');
    console.log('✅ Column videoUrl added to Galleries table');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumn();
