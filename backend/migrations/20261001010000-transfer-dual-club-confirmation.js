'use strict';

/** Dual-club confirmation fields for TransferHistories. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const has = tables.some((t) => String(t).toLowerCase() === 'transferhistories');
    if (!has) return;

    const desc = await queryInterface.describeTable('TransferHistories');

    if (!desc.status) {
      await queryInterface.addColumn('TransferHistories', 'status', {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'confirmed',
      });
      // Existing rows stay confirmed; new dual-confirm transfers use pending
      await queryInterface.sequelize.query(
        `UPDATE "TransferHistories" SET status = 'confirmed' WHERE status IS NULL OR status = ''`
      );
    }
    if (!desc.fromClubConfirmedAt) {
      await queryInterface.addColumn('TransferHistories', 'fromClubConfirmedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!desc.fromClubConfirmedBy) {
      await queryInterface.addColumn('TransferHistories', 'fromClubConfirmedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!desc.toClubConfirmedAt) {
      await queryInterface.addColumn('TransferHistories', 'toClubConfirmedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!desc.toClubConfirmedBy) {
      await queryInterface.addColumn('TransferHistories', 'toClubConfirmedBy', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!desc.rejectedAt) {
      await queryInterface.addColumn('TransferHistories', 'rejectedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!desc.rejectedByClubUserId) {
      await queryInterface.addColumn('TransferHistories', 'rejectedByClubUserId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!desc.rejectionReason) {
      await queryInterface.addColumn('TransferHistories', 'rejectionReason', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const has = tables.some((t) => String(t).toLowerCase() === 'transferhistories');
    if (!has) return;
    const desc = await queryInterface.describeTable('TransferHistories');
    for (const col of [
      'rejectionReason',
      'rejectedByClubUserId',
      'rejectedAt',
      'toClubConfirmedBy',
      'toClubConfirmedAt',
      'fromClubConfirmedBy',
      'fromClubConfirmedAt',
      'status',
    ]) {
      if (desc[col]) await queryInterface.removeColumn('TransferHistories', col);
    }
  },
};
