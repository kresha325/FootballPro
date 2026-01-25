"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Matches");
    if (!table.minutesPlayed) {
      await queryInterface.addColumn("Matches", "minutesPlayed", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } else {
      console.log('Kolona minutesPlayed ekziston, nuk u shtua përsëri.');
    }
    if (!table.goals) {
      await queryInterface.addColumn("Matches", "goals", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    } else {
      console.log('Kolona goals ekziston, nuk u shtua përsëri.');
    }
    if (!table.assists) {
      await queryInterface.addColumn("Matches", "assists", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    } else {
      console.log('Kolona assists ekziston, nuk u shtua përsëri.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Kontrollo nëse tabela ekziston para se të fshish kolonat
    let table;
    try {
      table = await queryInterface.describeTable("Matches");
    } catch (e) {
      // Tabela nuk ekziston, nuk ka asgjë për të fshirë
      return;
    }
    if (table.minutesPlayed) {
      await queryInterface.removeColumn("Matches", "minutesPlayed");
    }
    if (table.goals) {
      await queryInterface.removeColumn("Matches", "goals");
    }
    if (table.assists) {
      await queryInterface.removeColumn("Matches", "assists");
    }
  },
};
