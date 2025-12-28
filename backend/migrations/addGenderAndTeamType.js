const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function addGenderAndTeamType() {
  try {
    const queryInterface = sequelize.getQueryInterface();

    // Add gender to Users table
    await queryInterface.addColumn('Users', 'gender', {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
      defaultValue: null,
    });
    console.log('✅ gender column added to Users table');

    // Add teamType to ClubMembers table
    await queryInterface.addColumn('ClubMembers', 'teamType', {
      type: DataTypes.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'),
      allowNull: true,
      defaultValue: 'first_team',
    });
    console.log('✅ teamType column added to ClubMembers table');

    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

addGenderAndTeamType();
