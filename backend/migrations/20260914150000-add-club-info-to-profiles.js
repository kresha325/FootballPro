'use strict';

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());
}

async function addColumnIfMissing(queryInterface, table, column, definition) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (!(await tableExists(queryInterface, 'Profiles'))) return;

    await addColumnIfMissing(queryInterface, 'Profiles', 'founded', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Profiles', 'stadium', {
      type: Sequelize.STRING(191),
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Profiles', 'capacity', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, 'Profiles', 'league', {
      type: Sequelize.STRING(191),
      allowNull: true,
    });

    // Backfill from stats JSON when present (Postgres)
    try {
      await queryInterface.sequelize.query(`
        UPDATE "Profiles"
        SET
          founded = COALESCE(
            founded,
            NULLIF(regexp_replace(COALESCE(stats->>'founded', ''), '[^0-9]', '', 'g'), '')::integer
          ),
          stadium = COALESCE(stadium, NULLIF(stats->>'stadium', '')),
          capacity = COALESCE(
            capacity,
            NULLIF(regexp_replace(COALESCE(stats->>'capacity', ''), '[^0-9]', '', 'g'), '')::integer
          ),
          league = COALESCE(league, NULLIF(stats->>'league', ''))
        WHERE stats IS NOT NULL
      `);
    } catch (err) {
      console.warn('club-info backfill skipped:', err.message);
    }
  },

  down: async (queryInterface) => {
    if (!(await tableExists(queryInterface, 'Profiles'))) return;
    const desc = await queryInterface.describeTable('Profiles');
    for (const col of ['founded', 'stadium', 'capacity', 'league']) {
      if (desc[col]) await queryInterface.removeColumn('Profiles', col);
    }
  },
};
