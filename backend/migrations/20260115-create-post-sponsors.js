'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PostSponsors', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      postId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Posts',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      sponsorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Sponsors',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('PostSponsors');
    } catch (e) {
      // Nëse nuk ke leje ose tabela nuk ekziston, vazhdo
    }
    try {
      await queryInterface.dropTable('Sponsors');
    } catch (e) {
      // Nëse nuk ke leje ose tabela nuk ekziston, vazhdo
    }
  },
};
