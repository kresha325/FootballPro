const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

async function createClubMembersTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    // Check if table exists
    const tables = await queryInterface.showAllTables();
    if (tables.includes('ClubMembers')) {
      console.log('ClubMembers table already exists, skipping...');
      return;
    }

    // Create ClubMembers table
    await queryInterface.createTable('ClubMembers', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      clubId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      athleteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      },
      position: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      jerseyNumber: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      joinedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      leftAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    console.log('✅ ClubMembers table created successfully');
  } catch (error) {
    console.error('❌ Error creating ClubMembers table:', error);
    throw error;
  }
}

// Run migration
createClubMembersTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
