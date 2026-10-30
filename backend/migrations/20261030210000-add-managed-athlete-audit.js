'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('ClubMembers');
    if (!table.createdByUserId) {
      await queryInterface.addColumn('ClubMembers', 'createdByUserId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!table.creationSource) {
      await queryInterface.addColumn('ClubMembers', 'creationSource', {
        type: Sequelize.STRING(48),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('ClubMembers');
    if (table.creationSource) await queryInterface.removeColumn('ClubMembers', 'creationSource');
    if (table.createdByUserId) await queryInterface.removeColumn('ClubMembers', 'createdByUserId');
  },
};
