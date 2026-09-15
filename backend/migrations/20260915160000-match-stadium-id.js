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
    if (!(await tableExists(queryInterface, 'Matches'))) return;
    if (await columnExists(queryInterface, 'Matches', 'stadiumId')) return;

    await queryInterface.addColumn('Matches', 'stadiumId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Stadiums',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    try {
      await queryInterface.addIndex('Matches', ['stadiumId']);
    } catch (_e) {
      /* index may already exist */
    }
  },

  down: async (queryInterface) => {
    if (!(await tableExists(queryInterface, 'Matches'))) return;
    if (!(await columnExists(queryInterface, 'Matches', 'stadiumId'))) return;
    await queryInterface.removeColumn('Matches', 'stadiumId');
  },
};
