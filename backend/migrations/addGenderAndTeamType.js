module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add gender to Users table if not exists
    const usersDesc = await queryInterface.describeTable('Users');
    if (!usersDesc['gender']) {
      await queryInterface.addColumn('Users', 'gender', {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true,
        defaultValue: null,
      });
    }
    // Add teamType to ClubMembers table if not exists
    let clubMembersDesc;
    try {
      clubMembersDesc = await queryInterface.describeTable('ClubMembers');
    } catch (e) {
      // fallback: try lowercase (for some DBs)
      try {
        clubMembersDesc = await queryInterface.describeTable('clubmembers');
      } catch (e2) {
        throw new Error('Table ClubMembers/clubmembers not found');
      }
    }
    if (!clubMembersDesc['teamType']) {
      await queryInterface.addColumn('ClubMembers', 'teamType', {
        type: Sequelize.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'),
        allowNull: true,
        defaultValue: 'first_team',
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'gender');
    await queryInterface.removeColumn('ClubMembers', 'teamType');
    // Optionally drop ENUM types if needed
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_gender"');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ClubMembers_teamType"');
  }
};
