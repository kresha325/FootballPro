"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('VideoCalls')) {
      await queryInterface.createTable('VideoCalls', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        callerId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        receiverId: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        status: { type: Sequelize.ENUM('ringing','connected','ended'), defaultValue: 'ringing' },
        startTime: { type: Sequelize.DATE, allowNull: true },
        endTime: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('VideoCalls')) {
      await queryInterface.dropTable('VideoCalls');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_VideoCalls_status"');
    }
  }
};
