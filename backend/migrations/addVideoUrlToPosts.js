const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

async function addVideoUrlToPosts() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if column exists
    const tableDescription = await queryInterface.describeTable('Posts');
    
    if (!tableDescription.videoUrl) {
      console.log('Adding videoUrl column to Posts table...');
      await queryInterface.addColumn('Posts', 'videoUrl', {
        type: DataTypes.STRING,
        allowNull: true,
      });
      console.log('✓ videoUrl column added successfully');
    } else {
      console.log('videoUrl column already exists');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addVideoUrlToPosts();
