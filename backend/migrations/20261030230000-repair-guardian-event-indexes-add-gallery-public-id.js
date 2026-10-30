'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = new Set((await queryInterface.showAllTables()).map(String));
    if (!tables.has('GuardianConsentEvents')) {
      throw new Error('GuardianConsentEvents is missing; restore/repair the prerequisite consent-event migration before startup.');
    }

    // The original migration is already recorded in deployed SequelizeMeta on
    // healthy installations. This additive repair makes a partial legacy table
    // detectable and repairs its indexes without replacing audit data.
    const eventColumns = await queryInterface.describeTable('GuardianConsentEvents');
    for (const name of ['id', 'consentId', 'minorUserId', 'actorUserId', 'actorType', 'eventType', 'metadata', 'eventAt', 'createdAt']) {
      if (!eventColumns[name]) throw new Error(`GuardianConsentEvents is missing required column ${name}`);
    }
    const indexes = new Set((await queryInterface.showIndex('GuardianConsentEvents')).map((index) => index.name));
    if (!indexes.has('guardian_consent_events_minor_time_idx')) {
      await queryInterface.addIndex('GuardianConsentEvents', ['minorUserId', 'eventAt'], { name: 'guardian_consent_events_minor_time_idx' });
    }
    if (!indexes.has('guardian_consent_events_consent_time_idx')) {
      await queryInterface.addIndex('GuardianConsentEvents', ['consentId', 'eventAt'], { name: 'guardian_consent_events_consent_time_idx' });
    }

    // Sequelize pluralizes the Gallery model to `Galleries` (see the original
    // 20260304-create-gallery migration). Use the persisted table name here;
    // production does not have a singular `Gallery` table.
    const galleryColumns = await queryInterface.describeTable('Galleries');
    if (!galleryColumns.publicId) {
      await queryInterface.addColumn('Galleries', 'publicId', { type: Sequelize.STRING(255), allowNull: true });
    }
  },

  async down() {
    // Keep additive schema and audit indexes through application rollback.
  },
};
