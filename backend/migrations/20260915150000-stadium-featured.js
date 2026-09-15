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
    if (!(await tableExists(queryInterface, 'Stadiums'))) return;

    if (!(await columnExists(queryInterface, 'Stadiums', 'featured'))) {
      await queryInterface.addColumn('Stadiums', 'featured', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!(await columnExists(queryInterface, 'Stadiums', 'featuredStart'))) {
      await queryInterface.addColumn('Stadiums', 'featuredStart', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'Stadiums', 'featuredEnd'))) {
      await queryInterface.addColumn('Stadiums', 'featuredEnd', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    if (!(await tableExists(queryInterface, 'Stadiums'))) return;
    for (const col of ['featuredEnd', 'featuredStart', 'featured']) {
      if (await columnExists(queryInterface, 'Stadiums', col)) {
        await queryInterface.removeColumn('Stadiums', col);
      }
    }
  },
};
