const sequelize = require('../config/database');
const TransferHistory = require('../models/TransferHistory');
const ClubStaff = require('../models/ClubStaff');
const NationalTeam = require('../models/NationalTeam');

async function createTables() {
  try {
    // Sync all models with database
    await TransferHistory.sync({ alter: true });
    console.log('✅ TransferHistory table created/updated');
    
    await ClubStaff.sync({ alter: true });
    console.log('✅ ClubStaff table created/updated');
    
    await NationalTeam.sync({ alter: true });
    console.log('✅ NationalTeam table created/updated');

    console.log('All tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

createTables();
