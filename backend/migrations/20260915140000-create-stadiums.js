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

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await tableExists(queryInterface, 'Stadiums'))) {
      await queryInterface.createTable('Stadiums', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING(191),
          allowNull: false,
        },
        city: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        country: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        capacity: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        address: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        photo: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await queryInterface.addIndex('Stadiums', ['name']);
      await queryInterface.addIndex('Stadiums', ['city']);
    }

    if (await tableExists(queryInterface, 'Profiles')) {
      if (!(await columnExists(queryInterface, 'Profiles', 'stadiumId'))) {
        await queryInterface.addColumn('Profiles', 'stadiumId', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Stadiums',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
    }

    // Seed common Kosovar stadium if empty
    try {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*)::int AS c FROM "Stadiums"`
      );
      const count = rows?.[0]?.c ?? 0;
      if (count === 0) {
        await queryInterface.bulkInsert('Stadiums', [
          {
            name: 'Stadiumi Përparim Thaçi',
            city: 'Prizren',
            country: 'Kosovë',
            capacity: 8500,
            address: null,
            photo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            name: 'Stadiumi Fadil Vokrri',
            city: 'Prishtinë',
            country: 'Kosovë',
            capacity: 13500,
            address: null,
            photo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.warn('Stadium seed skipped:', err.message);
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'Profiles')) {
      if (await columnExists(queryInterface, 'Profiles', 'stadiumId')) {
        await queryInterface.removeColumn('Profiles', 'stadiumId');
      }
    }
    if (await tableExists(queryInterface, 'Stadiums')) {
      await queryInterface.dropTable('Stadiums');
    }
  },
};
