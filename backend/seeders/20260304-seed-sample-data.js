const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const pwd = await bcrypt.hash('athletepass', 10);
    // Insert a sample athlete and a sample post
    await queryInterface.bulkInsert('Users', [
      {
        id: 10002,
        email: 'athlete1@example.com',
        password: pwd,
        role: 'athlete',
        verified: true,
        firstName: 'Sample',
        lastName: 'Athlete',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ], {});

    await queryInterface.bulkInsert('Profiles', [
      {
        id: 10002,
        userId: 10002,
        bio: 'Sample athlete for local development',
        city: 'Testville',
        country: 'Testland',
        profilePhoto: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ], {});

    await queryInterface.bulkInsert('Posts', [
      {
        id: 10001,
        userId: 10002,
        content: 'Hello from sample athlete!',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Posts', { id: 10001 }, {});
    await queryInterface.bulkDelete('Profiles', { id: 10002 }, {});
    await queryInterface.bulkDelete('Users', { id: 10002 }, {});
  },
};
