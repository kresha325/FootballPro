const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

async function addReceiverIdColumn() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    
    // Check if column exists
    const tableDescription = await queryInterface.describeTable('Messages');
    
    if (!tableDescription.receiverId) {
      console.log('Adding receiverId column to Messages table...');
      await queryInterface.addColumn('Messages', 'receiverId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      });
      console.log('✓ receiverId column added successfully');
    } else {
      console.log('receiverId column already exists');
    }

    // Make conversationId nullable
    if (tableDescription.conversationId && tableDescription.conversationId.allowNull === false) {
      console.log('Making conversationId nullable...');
      await queryInterface.changeColumn('Messages', 'conversationId', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      console.log('✓ conversationId is now nullable');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addReceiverIdColumn();
