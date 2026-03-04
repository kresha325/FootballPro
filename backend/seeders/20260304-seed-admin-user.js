const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
    await queryInterface.bulkInsert('Users', [
      {
        id: 10001,
        email: 'admin@footballpro.local',
        password: passwordHash,
        role: 'admin',
        verified: true,
        firstName: 'System',
        lastName: 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { email: 'admin@footballpro.local' }, {});
  },
};
