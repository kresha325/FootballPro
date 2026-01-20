"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Matches", "minutesPlayed", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Matches", "goals", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn("Matches", "assists", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Matches", "minutesPlayed");
    await queryInterface.removeColumn("Matches", "goals");
    await queryInterface.removeColumn("Matches", "assists");
  },
};
