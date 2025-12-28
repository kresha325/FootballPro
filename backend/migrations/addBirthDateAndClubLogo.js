const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addBirthDateAndClubLogoToProfile() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // Add birthDate column
    await queryInterface.addColumn('Profiles', 'birthDate', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
    console.log('✅ birthDate column added to Profiles');

    // Add clubLogo column
    await queryInterface.addColumn('Profiles', 'clubLogo', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    console.log('✅ clubLogo column added to Profiles');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run migration
addBirthDateAndClubLogoToProfile()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
