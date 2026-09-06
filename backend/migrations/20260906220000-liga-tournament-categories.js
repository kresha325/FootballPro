'use strict';

async function columnExists(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return !!desc[column];
  } catch {
    return false;
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await columnExists(queryInterface, 'Tournaments', 'ligaId')) {
      // still try club member column
    } else {
      await queryInterface.addColumn('Tournaments', 'ligaId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Ligas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, 'Tournaments', 'sourceRole'))) {
      await queryInterface.addColumn('Tournaments', 'sourceRole', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'Tournaments', 'category'))) {
      await queryInterface.addColumn('Tournaments', 'category', {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: 'open',
      });
    }

    if (!(await columnExists(queryInterface, 'ClubMembers', 'competitionCategory'))) {
      await queryInterface.addColumn('ClubMembers', 'competitionCategory', {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: 'Kategoria e ligës/turneut ku klubi e vendos lojtarin (p.sh. u11)',
      });
    }

    try {
      await queryInterface.addIndex('Tournaments', ['ligaId'], { name: 'tournaments_liga_id_idx' });
    } catch {
      /* exists */
    }
    try {
      await queryInterface.addIndex('Tournaments', ['sourceRole', 'category'], {
        name: 'tournaments_source_category_idx',
      });
    } catch {
      /* exists */
    }
  },

  down: async (queryInterface) => {
    if (await columnExists(queryInterface, 'ClubMembers', 'competitionCategory')) {
      await queryInterface.removeColumn('ClubMembers', 'competitionCategory');
    }
    if (await columnExists(queryInterface, 'Tournaments', 'category')) {
      await queryInterface.removeColumn('Tournaments', 'category');
    }
    if (await columnExists(queryInterface, 'Tournaments', 'sourceRole')) {
      await queryInterface.removeColumn('Tournaments', 'sourceRole');
    }
    if (await columnExists(queryInterface, 'Tournaments', 'ligaId')) {
      await queryInterface.removeColumn('Tournaments', 'ligaId');
    }
  },
};
