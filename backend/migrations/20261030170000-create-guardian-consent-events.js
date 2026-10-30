'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('GuardianConsentEvents')) return;
    await queryInterface.createTable('GuardianConsentEvents', {
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
    await queryInterface.addIndex('GuardianConsentEvents', ['minorUserId', 'eventAt'], { name: 'guardian_consent_events_minor_time_idx' });
    await queryInterface.addIndex('GuardianConsentEvents', ['consentId', 'eventAt'], { name: 'guardian_consent_events_consent_time_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('GuardianConsentEvents');
  },
};
