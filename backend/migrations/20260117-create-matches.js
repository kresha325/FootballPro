"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Matches", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      tournamentId: {
        type: Sequelize.INTEGER,
        references: { model: "Tournaments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      homeUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      awayUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      scoreHome: { type: Sequelize.INTEGER },
      scoreAway: { type: Sequelize.INTEGER },
      matchDate: { type: Sequelize.DATE },
      status: {
        type: Sequelize.ENUM("scheduled", "ongoing", "finished"),
        defaultValue: "scheduled",
      },
      round: { type: Sequelize.INTEGER },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Matches");
  },
};
