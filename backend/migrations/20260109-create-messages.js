module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Messages')) {
      await queryInterface.createTable('Messages', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        conversationId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        senderId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        receiverId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        type: {
          type: Sequelize.ENUM('text', 'image', 'file', 'audio', 'video'),
          defaultValue: 'text',
        },
        fileUrl: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        fileName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        replyToId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        edited: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        deleted: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        isRead: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Messages');
  },
};
