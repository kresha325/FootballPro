'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('VideoCallHistories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      roomId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      participants: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('completed', 'missed', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'completed',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('VideoCallHistories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_VideoCallHistories_status";');
  }
};
