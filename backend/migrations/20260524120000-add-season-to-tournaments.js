const { footballSeasonFromDate, calendarEditionFromDate } = require('../utils/footballSeason');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Tournaments').catch(() => null);
    if (!desc) return;

    if (!desc.season) {
      await queryInterface.addColumn('Tournaments', 'season', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    }

    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, type, "startDate", "createdAt", season FROM "Tournaments" WHERE season IS NULL OR season = \'\''
    );

    for (const row of rows || []) {
      const ref = row.startDate || row.createdAt || new Date();
      const season =
        row.type === 'league'
          ? footballSeasonFromDate(ref)
          : calendarEditionFromDate(ref);
      if (!season) continue;
      await queryInterface.sequelize.query(
        'UPDATE "Tournaments" SET season = :season WHERE id = :id',
        { replacements: { season, id: row.id } }
      );
    }
  },

  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('Tournaments').catch(() => null);
    if (desc?.season) {
      await queryInterface.removeColumn('Tournaments', 'season');
    }
  },
};
