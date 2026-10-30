'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('GuardianConsents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      minorUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      guardianUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      guardianEmail: { type: Sequelize.STRING(320), allowNull: false },
      guardianName: { type: Sequelize.STRING(160), allowNull: true },
      relationship: { type: Sequelize.STRING(32), allowNull: true },
      consentPurpose: { type: Sequelize.STRING(64), allowNull: false },
      consentScope: { type: Sequelize.JSON, allowNull: false },
      policyVersion: { type: Sequelize.STRING(32), allowNull: false },
      verificationMethod: { type: Sequelize.STRING(48), allowNull: false },
      verificationTokenHash: { type: Sequelize.STRING(64), allowNull: true, unique: true },
      verificationTokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
      managementTokenHash: { type: Sequelize.STRING(64), allowNull: true, unique: true },
      managementTokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
      verifiedAt: { type: Sequelize.DATE, allowNull: true },
      revokedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('GuardianConsents', ['minorUserId', 'verifiedAt', 'revokedAt'], {
      name: 'guardian_consents_minor_state_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('GuardianConsents');
  },
};
