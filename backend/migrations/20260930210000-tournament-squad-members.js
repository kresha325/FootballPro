'use strict';

/** Club-nominated athletes for a tournament (not standings participants). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('TournamentSquadMembers')) return;

    await queryInterface.createTable('TournamentSquadMembers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tournamentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Tournaments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      clubUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      athleteUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('TournamentSquadMembers', ['tournamentId', 'athleteUserId'], {
      unique: true,
      name: 'tournament_squad_unique_athlete',
    });
    await queryInterface.addIndex('TournamentSquadMembers', ['tournamentId', 'clubUserId'], {
      name: 'tournament_squad_by_club',
    });
    await queryInterface.addIndex('TournamentSquadMembers', ['athleteUserId'], {
      name: 'tournament_squad_by_athlete',
    });

    // Liga editions compete as clubs; athletes are nominated on the squad list.
    try {
      await queryInterface.sequelize.query(
        `UPDATE "Tournaments" SET "participantType" = 'club' WHERE "ligaId" IS NOT NULL AND ("participantType" IS NULL OR "participantType" = 'individual')`
      );
    } catch (_e) {
      /* ignore if column/table naming differs */
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TournamentSquadMembers').catch(() => {});
  },
};
