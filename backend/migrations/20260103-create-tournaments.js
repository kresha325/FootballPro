module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Tournaments')) {
      await queryInterface.createTable('Tournaments', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        type: {
          type: Sequelize.ENUM('league', 'cup', 'knockout'),
          allowNull: false,
        },
        startDate: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        endDate: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        maxParticipants: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('open', 'ongoing', 'finished'),
          defaultValue: 'open',
        },
        creatorId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
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

    if (!tables.includes('TournamentParticipants')) {
      await queryInterface.createTable('TournamentParticipants', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        tournamentId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Tournaments',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        points: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        wins: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        draws: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        losses: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        goalsFor: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        goalsAgainst: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        status: {
          type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
          defaultValue: 'pending',
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
    await queryInterface.dropTable('TournamentParticipants');
    await queryInterface.dropTable('Tournaments');
  },
};
