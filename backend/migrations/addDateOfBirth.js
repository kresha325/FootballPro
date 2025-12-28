const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addDateOfBirthColumn() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('Users');
    
    if (tableDescription.dateOfBirth) {
      console.log('dateOfBirth column already exists, skipping...');
      return;
    }

    // Add dateOfBirth column to Users table
    await queryInterface.addColumn('Users', 'dateOfBirth', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });

    console.log('✅ dateOfBirth column added to Users table');
  } catch (error) {
    console.error('❌ Error adding dateOfBirth column:', error);
    throw error;
  }
}

// Run migration
addDateOfBirthColumn()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
