'use strict';

async function describeSafe(queryInterface, table) {
  try {
    return await queryInterface.describeTable(table);
  } catch (_err) {
    return null;
  }
}

async function ensureColumn(queryInterface, table, column, spec) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc || desc[column]) return;
  await queryInterface.addColumn(table, column, spec);
}

async function ensureIndex(queryInterface, table, fields, name) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc) return;
  try {
    await queryInterface.addIndex(table, fields, { name });
  } catch (_err) {
    /* index already exists */
  }
}

/** Operational admin tables. Existing admins keep full access until adminRole is set. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await ensureColumn(queryInterface, 'Users', 'adminRole', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'Users', 'tokenVersion', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, 'Profiles', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    const audit = await describeSafe(queryInterface, 'AdminAuditLogs');
    if (!audit) {
      await queryInterface.createTable('AdminAuditLogs', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        adminId: { type: Sequelize.INTEGER, allowNull: false },
        action: { type: Sequelize.STRING(64), allowNull: false },
        entity: { type: Sequelize.STRING(64), allowNull: false },
        entityId: { type: Sequelize.STRING(64), allowNull: true },
        result: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'success' },
        reason: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }
    await ensureIndex(queryInterface, 'AdminAuditLogs', ['createdAt'], 'admin_audit_created');
    await ensureIndex(queryInterface, 'AdminAuditLogs', ['entity', 'entityId'], 'admin_audit_entity');
    await ensureIndex(queryInterface, 'AdminAuditLogs', ['adminId'], 'admin_audit_admin');

    const settings = await describeSafe(queryInterface, 'PlatformSettings');
    if (!settings) {
      await queryInterface.createTable('PlatformSettings', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        value: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        updatedBy: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }

    const errors = await describeSafe(queryInterface, 'AdminErrorGroups');
    if (!errors) {
      await queryInterface.createTable('AdminErrorGroups', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        fingerprint: { type: Sequelize.STRING(191), allowNull: false, unique: true },
        method: { type: Sequelize.STRING(12), allowNull: true },
        path: { type: Sequelize.STRING(191), allowNull: false },
        message: { type: Sequelize.STRING(300), allowNull: false },
        severity: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'HIGH' },
        statusCode: { type: Sequelize.INTEGER, allowNull: true },
        count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        firstSeenAt: { type: Sequelize.DATE, allowNull: false },
        lastSeenAt: { type: Sequelize.DATE, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }
    await ensureIndex(queryInterface, 'AdminErrorGroups', ['lastSeenAt'], 'admin_errors_last_seen');

    const jobs = await describeSafe(queryInterface, 'AdminJobRuns');
    if (!jobs) {
      await queryInterface.createTable('AdminJobRuns', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING(64), allowNull: false },
        status: { type: Sequelize.STRING(16), allowNull: false },
        startedAt: { type: Sequelize.DATE, allowNull: false },
        finishedAt: { type: Sequelize.DATE, allowNull: true },
        durationMs: { type: Sequelize.INTEGER, allowNull: true },
        error: { type: Sequelize.STRING(300), allowNull: true },
        nextRunAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }
    await ensureIndex(queryInterface, 'AdminJobRuns', ['name', 'startedAt'], 'admin_jobs_name_started');

    const adjustments = await describeSafe(queryInterface, 'FinancialAdjustments');
    if (!adjustments) {
      await queryInterface.createTable('FinancialAdjustments', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        adminId: { type: Sequelize.INTEGER, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false },
        direction: { type: Sequelize.STRING(16), allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        balanceBefore: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        balanceAfter: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: false },
        ledgerTransactionId: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }
    await ensureIndex(queryInterface, 'FinancialAdjustments', ['userId', 'createdAt'], 'fin_adj_user_created');
    await ensureIndex(queryInterface, 'FinancialAdjustments', ['adminId'], 'fin_adj_admin');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FinancialAdjustments').catch(() => {});
    await queryInterface.dropTable('AdminJobRuns').catch(() => {});
    await queryInterface.dropTable('AdminErrorGroups').catch(() => {});
    await queryInterface.dropTable('PlatformSettings').catch(() => {});
    await queryInterface.dropTable('AdminAuditLogs').catch(() => {});
    await queryInterface.removeColumn('Profiles', 'featured').catch(() => {});
    await queryInterface.removeColumn('Users', 'tokenVersion').catch(() => {});
    await queryInterface.removeColumn('Users', 'adminRole').catch(() => {});
  },
};
