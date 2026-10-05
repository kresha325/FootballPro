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

async function ensureIndex(queryInterface, table, fields, options) {
  try {
    await queryInterface.addIndex(table, fields, options);
  } catch (_err) {
    /* index already exists */
  }
}

async function widenType(queryInterface, Sequelize) {
  const dialect = queryInterface.sequelize.getDialect();
  if (dialect === 'postgres') {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_name = 'Notifications' AND column_name = 'type'
    `);
    const udt = String(rows?.[0]?.udt_name || '');
    if (udt.startsWith('enum') || udt.includes('enum')) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "Notifications"
        ALTER COLUMN "type" TYPE VARCHAR(64)
        USING "type"::text
      `);
    }
    return;
  }
  if (dialect === 'mysql' || dialect === 'mariadb') {
    await queryInterface.changeColumn('Notifications', 'type', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });
  }
}

/** Extends the existing Notifications table. Does not create a second system. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await describeSafe(queryInterface, 'Notifications');
    if (desc) {
      await widenType(queryInterface, Sequelize);
      await ensureColumn(queryInterface, 'Notifications', 'eventType', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await ensureColumn(queryInterface, 'Notifications', 'category', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
      await ensureColumn(queryInterface, 'Notifications', 'priority', {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'NORMAL',
      });
      await ensureColumn(queryInterface, 'Notifications', 'readAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await ensureColumn(queryInterface, 'Notifications', 'expiresAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await ensureColumn(queryInterface, 'Notifications', 'idempotencyKey', {
        type: Sequelize.STRING(191),
        allowNull: true,
      });
      await ensureIndex(queryInterface, 'Notifications', ['userId', 'isRead'], {
        name: 'notifications_user_read',
      });
      await ensureIndex(queryInterface, 'Notifications', ['userId', 'createdAt'], {
        name: 'notifications_user_created',
      });
      await ensureIndex(queryInterface, 'Notifications', ['userId', 'category', 'isRead'], {
        name: 'notifications_user_category_read',
      });
      await ensureIndex(queryInterface, 'Notifications', ['idempotencyKey'], {
        name: 'notifications_idempotency_key',
        unique: true,
      });
    }

    const pref = await describeSafe(queryInterface, 'NotificationPreferences');
    if (!pref) {
      await queryInterface.createTable('NotificationPreferences', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        category: { type: Sequelize.STRING(32), allowNull: false },
        inApp: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        push: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        email: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await ensureIndex(queryInterface, 'NotificationPreferences', ['userId', 'category'], {
        name: 'notification_prefs_user_category',
        unique: true,
      });
    }

    const devices = await describeSafe(queryInterface, 'PushDevices');
    if (!devices) {
      await queryInterface.createTable('PushDevices', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        platform: { type: Sequelize.STRING(16), allowNull: false },
        token: { type: Sequelize.TEXT, allowNull: false },
        tokenKey: { type: Sequelize.STRING(191), allowNull: false },
        deviceId: { type: Sequelize.STRING(128), allowNull: true },
        enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        lastSeenAt: { type: Sequelize.DATE, allowNull: true },
        invalidatedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await ensureIndex(queryInterface, 'PushDevices', ['tokenKey'], {
        name: 'push_devices_token_key',
        unique: true,
      });
      await ensureIndex(queryInterface, 'PushDevices', ['userId', 'enabled'], {
        name: 'push_devices_user_enabled',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PushDevices').catch(() => {});
    await queryInterface.dropTable('NotificationPreferences').catch(() => {});
    const desc = await describeSafe(queryInterface, 'Notifications');
    if (!desc) return;
    for (const column of ['eventType', 'category', 'priority', 'readAt', 'expiresAt', 'idempotencyKey']) {
      if (desc[column]) {
        await queryInterface.removeColumn('Notifications', column).catch(() => {});
      }
    }
  },
};
