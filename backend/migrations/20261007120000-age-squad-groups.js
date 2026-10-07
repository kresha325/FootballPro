'use strict';

/** Age-group squad letter (U13/A, U13/B, U13/C) on roster rows and tournament entries. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const members = await queryInterface.describeTable('ClubMembers').catch(() => null);
    if (members && !members.squadGroup) {
      await queryInterface.addColumn('ClubMembers', 'squadGroup', {
        type: Sequelize.STRING(1),
        allowNull: true,
      });
    }

    const participants = await queryInterface.describeTable('TournamentParticipants').catch(() => null);
    if (participants && !participants.squadGroup) {
      await queryInterface.addColumn('TournamentParticipants', 'squadGroup', {
        type: Sequelize.STRING(1),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const members = await queryInterface.describeTable('ClubMembers').catch(() => null);
    if (members?.squadGroup) {
      await queryInterface.removeColumn('ClubMembers', 'squadGroup');
    }
    const participants = await queryInterface.describeTable('TournamentParticipants').catch(() => null);
    if (participants?.squadGroup) {
      await queryInterface.removeColumn('TournamentParticipants', 'squadGroup');
    }
  },
};
