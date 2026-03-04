module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Users')) {
      await queryInterface.createTable('Users', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        joncoinBalance: {
          type: Sequelize.DECIMAL(12,2),
          allowNull: false,
          defaultValue: 0,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        role: {
          type: Sequelize.ENUM('athlete', 'coach', 'scout', 'manager', 'referee', 'club', 'federation', 'liga', 'media', 'business', 'admin'),
          allowNull: false,
        },
        premium: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        googleId: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: true,
        },
        facebookId: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: true,
        },
        pushTokenMobile: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        pushTokenWeb: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        dateOfBirth: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        gender: {
          type: Sequelize.ENUM('male', 'female', 'other'),
          allowNull: true,
        },
        points: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        level: {
          type: Sequelize.INTEGER,
          defaultValue: 1,
        },
        experience: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        resetPasswordToken: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        resetPasswordExpire: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Users');
  },
};
