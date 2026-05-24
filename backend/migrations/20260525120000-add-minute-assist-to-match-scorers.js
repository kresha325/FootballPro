'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('MatchScorers', 'minute', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('MatchScorers', 'assistUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('MatchScorers', 'side', {
      type: Sequelize.ENUM('home', 'away'),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('MatchScorers', 'side');
    await queryInterface.removeColumn('MatchScorers', 'assistUserId');
    await queryInterface.removeColumn('MatchScorers', 'minute');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_MatchScorers_side";');
  },
};
