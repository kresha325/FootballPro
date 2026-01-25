// Migration for WithdrawalRequests table
'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('WithdrawalRequests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(12,2), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('WithdrawalRequests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_WithdrawalRequests_status";');
  }
};
