module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Posts')) {
      await queryInterface.createTable('Posts', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        userId: {
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
        imageUrl: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        videoUrl: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        location: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        locationLat: {
          type: Sequelize.DOUBLE,
          allowNull: true,
        },
        locationLng: {
          type: Sequelize.DOUBLE,
          allowNull: true,
        },
        mentions: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: [],
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
    await queryInterface.dropTable('Posts');
  },
};
