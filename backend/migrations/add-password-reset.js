
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Kontrollo nëse ekziston kolona resetPasswordToken
    const [results] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name='Users' AND column_name='resetPasswordToken';
    `);
    if (results.length === 0) {
      await queryInterface.addColumn('Users', 'resetPasswordToken', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    // Kontrollo nëse ekziston kolona resetPasswordExpire
    const [results2] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name='Users' AND column_name='resetPasswordExpire';
    `);
    if (results2.length === 0) {
      await queryInterface.addColumn('Users', 'resetPasswordExpire', {
        type: Sequelize.BIGINT,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'resetPasswordToken');
    await queryInterface.removeColumn('Users', 'resetPasswordExpire');
  }
};
