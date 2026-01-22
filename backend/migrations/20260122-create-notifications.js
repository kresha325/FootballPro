module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Notifications')) {
      await queryInterface.createTable('Notifications', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        actorId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        type: {
          type: Sequelize.ENUM(
            'like',
            'comment',
            'follow',
            'message',
            'mention',
            'post',
            'tournament',
            'match',
            'achievement',
            'system'
          ),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        link: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        entityType: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        entityId: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        isRead: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
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
  down: async (queryInterface) => {
    await queryInterface.dropTable('Notifications');
  }
};
