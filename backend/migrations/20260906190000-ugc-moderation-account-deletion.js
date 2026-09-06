'use strict';

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());
}

async function columnExists(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return !!desc[column];
  } catch (_e) {
    return false;
  }
}

async function addColumnIfMissing(queryInterface, Sequelize, table, column, definition) {
  if (await columnExists(queryInterface, table, column)) return;
  await queryInterface.addColumn(table, column, definition);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'Users')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'bannedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'banReason', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'deletedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'deletionRequestedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await tableExists(queryInterface, 'Reports'))) {
      await queryInterface.createTable('Reports', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        reporterId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        targetType: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        targetId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        reason: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        details: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'pending',
        },
        reviewedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        reviewedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('Reports', ['status', 'createdAt']);
      await queryInterface.addIndex('Reports', ['targetType', 'targetId']);
      await queryInterface.addIndex('Reports', ['reporterId', 'targetType', 'targetId']);
    }

    if (!(await tableExists(queryInterface, 'Blocks'))) {
      await queryInterface.createTable('Blocks', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        blockerId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        blockedId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('Blocks', ['blockerId', 'blockedId'], { unique: true });
      await queryInterface.addIndex('Blocks', ['blockedId']);
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'Blocks')) {
      await queryInterface.dropTable('Blocks');
    }
    if (await tableExists(queryInterface, 'Reports')) {
      await queryInterface.dropTable('Reports');
    }
    if (await tableExists(queryInterface, 'Users')) {
      for (const col of ['bannedAt', 'banReason', 'deletedAt', 'deletionRequestedAt']) {
        if (await columnExists(queryInterface, 'Users', col)) {
          await queryInterface.removeColumn('Users', col);
        }
      }
    }
  },
};
