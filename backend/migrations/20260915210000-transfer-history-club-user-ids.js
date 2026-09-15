'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const has = tables.some((t) => String(t).toLowerCase() === 'transferhistories');
    if (!has) return;

    const desc = await queryInterface.describeTable('TransferHistories');
    if (!desc.fromClubUserId) {
      await queryInterface.addColumn('TransferHistories', 'fromClubUserId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!desc.toClubUserId) {
      await queryInterface.addColumn('TransferHistories', 'toClubUserId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const has = tables.some((t) => String(t).toLowerCase() === 'transferhistories');
    if (!has) return;
    const desc = await queryInterface.describeTable('TransferHistories');
    if (desc.toClubUserId) await queryInterface.removeColumn('TransferHistories', 'toClubUserId');
    if (desc.fromClubUserId) await queryInterface.removeColumn('TransferHistories', 'fromClubUserId');
  },
};
