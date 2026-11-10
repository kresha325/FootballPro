'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('GuardianConsents');
    if (!columns.consentExpiresAt) {
      await queryInterface.addColumn('GuardianConsents', 'consentExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // Existing channel grants were previously unbounded. Give them one year
    // from approval, matching the new policy; already-old grants expire now.
    await queryInterface.sequelize.query(`
      UPDATE "GuardianConsents"
      SET "consentExpiresAt" = "verifiedAt" + INTERVAL '1 year'
      WHERE "consentPurpose" = 'minor_communication'
        AND "verifiedAt" IS NOT NULL
        AND "consentExpiresAt" IS NULL
    `);

    const indexes = new Set((await queryInterface.showIndex('GuardianConsents')).map((index) => index.name));
    if (!indexes.has('guardian_consents_minor_purpose_expiry_idx')) {
      await queryInterface.addIndex('GuardianConsents', ['minorUserId', 'consentPurpose', 'consentExpiresAt'], {
        name: 'guardian_consents_minor_purpose_expiry_idx',
      });
    }
  },

  async down() {
    // Removing this column would make expired professional-contact grants
    // appear valid again after an application rollback.
    throw new Error('Do not remove communication consent expiry; rollback application code only.');
  },
};
