'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CompetitionAuditEvents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tournamentId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Tournaments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      matchId: { type: Sequelize.INTEGER, allowNull: true },
      actorUserId: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      eventType: { type: Sequelize.STRING(48), allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      eventAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('CompetitionAuditEvents', ['tournamentId', 'eventAt'], { name: 'competition_audit_tournament_time_idx' });
    await queryInterface.addIndex('CompetitionAuditEvents', ['matchId'], { name: 'competition_audit_match_idx' });
  },

  async down() {
    throw new Error('Competition fixture audit records are append-only; roll back application code only.');
  },
};
