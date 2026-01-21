"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");
    if (!table.sellerId) {
      await queryInterface.addColumn("Products", "sellerId", {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("Products");
    if (table.sellerId) {
      await queryInterface.removeColumn("Products", "sellerId");
    }
  },
};
