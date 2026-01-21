"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Likes");
    if (!table.emoji) {
      await queryInterface.addColumn("Likes", "emoji", {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Likes");
    if (table.emoji) {
      await queryInterface.removeColumn("Likes", "emoji");
    }
  },
};
