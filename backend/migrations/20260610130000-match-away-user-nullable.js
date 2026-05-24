'use strict';

/** Knockout bracket slots may await an opponent (TBD). */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      await queryInterface.changeColumn('Matches', 'awayUserId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      return;
    }
    await queryInterface.sequelize.query(`
      ALTER TABLE "Matches" ALTER COLUMN "awayUserId" DROP NOT NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Matches', 'awayUserId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
