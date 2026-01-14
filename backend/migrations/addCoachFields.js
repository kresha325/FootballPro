module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc['coachAffiliation']) {
      await queryInterface.addColumn('Profiles', 'coachAffiliation', {
        type: Sequelize.ENUM('club', 'independent', 'personal_trainer'),
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!desc['coachCategory']) {
      await queryInterface.addColumn('Profiles', 'coachCategory', {
        type: Sequelize.ENUM(
          'general_trainer',
          'assistant_trainer',
          'fitness_trainer',
          'goalkeeper_trainer',
          'technical_trainer',
          'tactical_trainer',
          'psychological_trainer',
          'youth_trainer',
          'rehabilitation_trainer'
        ),
        allowNull: true,
        defaultValue: null,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Profiles', 'coachAffiliation');
    await queryInterface.removeColumn('Profiles', 'coachCategory');
    // Optionally drop ENUM types if needed
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_coachAffiliation"');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_coachCategory"');
  }
};
