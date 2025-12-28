const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addCoachFields() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    // Add coachAffiliation to Profiles table
    await queryInterface.addColumn('Profiles', 'coachAffiliation', {
      type: DataTypes.ENUM('club', 'independent', 'personal_trainer'),
      allowNull: true,
      defaultValue: null,
    });
    console.log('✅ coachAffiliation column added to Profiles table');

    // Add coachCategory to Profiles table
    await queryInterface.addColumn('Profiles', 'coachCategory', {
      type: DataTypes.ENUM(
        'general_trainer',
        'assistant_trainer',
        'fitness_trainer',
        'goalkeeper_trainer',
        'technical_trainer',
        'tactical_trainer',
        'psychological_trainer',
        'youth_trainer',
        'rehabilitation_trainer'
      ),
      allowNull: true,
      defaultValue: null,
    });
    console.log('✅ coachCategory column added to Profiles table');

    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

addCoachFields();
