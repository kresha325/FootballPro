module.exports = {
  up: async (queryInterface, Sequelize) => {
        // Krijo tipin ENUM për staffRole nëse mungon
        await queryInterface.sequelize.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ClubStaff_staffRole') THEN
              CREATE TYPE "enum_ClubStaff_staffRole" AS ENUM (
                'president', 'vice_president', 'chairman', 'ceo', 'general_manager', 'sporting_director', 'technical_director',
                'director_of_football', 'academy_director', 'youth_director', 'team_manager', 'secretary_general', 'secretary',
                'head_coach', 'assistant_coach', 'fitness_coach', 'goalkeeper_coach', 'technical_coach', 'tactical_coach',
                'medical_staff', 'doctor', 'assistant_doctor', 'physiotherapist', 'sports_psychologist', 'nutritionist',
                'masseur', 'scout', 'analyst', 'video_analyst', 'media_officer', 'security_officer', 'logistics_manager',
                'kit_manager', 'equipment_manager', 'groundskeeper', 'other'
              );
            END IF;
          END$$;
        `);
    // TransferHistory table
    await queryInterface.createTable('TransferHistories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      transferType: { type: Sequelize.ENUM('player_transfer', 'coach_appointment', 'staff_appointment', 'loan'), allowNull: false },
      fromClub: { type: Sequelize.STRING, allowNull: true },
      toClub: { type: Sequelize.STRING, allowNull: false },
      position: { type: Sequelize.STRING, allowNull: true },
      season: { type: Sequelize.STRING, allowNull: false },
      transferDate: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      transferFee: { type: Sequelize.STRING, allowNull: true },
      contractUntil: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // ClubStaff table
    await queryInterface.createTable('ClubStaff', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      clubId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      staffId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      staffRole: { type: Sequelize.ENUM(
        'president',
        'vice_president',
        'chairman',
        'ceo',
        'general_manager',
        'sporting_director',
        'technical_director',
        'director_of_football',
        'academy_director',
        'youth_director',
        'team_manager',
        'secretary_general',
        'secretary',
        'head_coach',
        'assistant_coach',
        'fitness_coach',
        'goalkeeper_coach',
        'technical_coach',
        'tactical_coach',
        'medical_staff',
        'doctor',
        'assistant_doctor',
        'physiotherapist',
        'sports_psychologist',
        'nutritionist',
        'masseur',
        'scout',
        'analyst',
        'video_analyst',
        'media_officer',
        'security_officer',
        'logistics_manager',
        'kit_manager',
        'equipment_manager',
        'groundskeeper',
        'other'
      ), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'active', 'inactive'), defaultValue: 'pending' },
      joinedAt: { type: Sequelize.DATE, allowNull: true },
      leftAt: { type: Sequelize.DATE, allowNull: true },
      contractUntil: { type: Sequelize.STRING, allowNull: true },
      teamType: { type: Sequelize.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'), defaultValue: 'first_team' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // NationalTeam table
    await queryInterface.createTable('NationalTeams', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nationalTeamId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      playerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
      teamCategory: { type: Sequelize.ENUM('senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'women_senior', 'women_u23', 'women_u21', 'women_u19', 'women_u17'), allowNull: false },
      position: { type: Sequelize.STRING, allowNull: true },
      jerseyNumber: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.ENUM('pending', 'active', 'inactive', 'retired'), defaultValue: 'pending' },
      capsEarned: { type: Sequelize.INTEGER, defaultValue: 0 },
      goals: { type: Sequelize.INTEGER, defaultValue: 0 },
      debutDate: { type: Sequelize.DATE, allowNull: true },
      captaincy: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('NationalTeams');
    await queryInterface.dropTable('ClubStaff');
    await queryInterface.dropTable('TransferHistories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ClubStaff_staffRole"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ClubStaff_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ClubStaff_teamType"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_NationalTeams_teamCategory"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_NationalTeams_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TransferHistories_transferType"');
  }
};
