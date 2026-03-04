module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Streams')) {
      await queryInterface.createTable('Streams', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        streamerId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        isLive: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        viewers: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        isPremium: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        type: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null,
        },
        streamKey: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: true,
        },
        rtmpUrl: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        videoUrl: {
          type: Sequelize.STRING,
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

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Streams');
  },
};
