'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('GuardianConsentEvents')) await queryInterface.createTable('GuardianConsentEvents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      consentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'GuardianConsents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      minorUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      actorUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      actorType: { type: Sequelize.STRING(32), allowNull: false },
      eventType: { type: Sequelize.STRING(64), allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      eventAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    const indexes = await queryInterface.showIndex('GuardianConsentEvents');
    const existingNames = new Set(indexes.map((index) => index.name));
    if (!existingNames.has('guardian_consent_events_minor_time_idx')) {
      await queryInterface.addIndex('GuardianConsentEvents', ['minorUserId', 'eventAt'], { name: 'guardian_consent_events_minor_time_idx' });
    }
    if (!existingNames.has('guardian_consent_events_consent_time_idx')) {
      await queryInterface.addIndex('GuardianConsentEvents', ['consentId', 'eventAt'], { name: 'guardian_consent_events_consent_time_idx' });
    }
  },

  async down() {
    throw new Error('GuardianConsentEvents is an audit log; preserve it during rollback and roll back application code only.');
  },
};
