module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    const roles = [
      'athlete',
      'coach',
      'scout',
      'manager',
      'referee',
      'club',
      'federation',
      'liga',
      'media',
      'business',
      'admin',
    ];

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'referee';"
      );
      return;
    }

    await queryInterface.changeColumn('Users', 'role', {
      type: Sequelize.ENUM(...roles),
      allowNull: false,
    });
  },

  down: async () => {
    // Enum value removal is not supported safely across dialects.
  },
};
