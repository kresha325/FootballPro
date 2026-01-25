module.exports = {
  up: async (queryInterface, Sequelize) => {
        // Krijo tipin ENUM nëse mungon (idempotent)
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
    const dialect = queryInterface.sequelize.getDialect();
    const roles = [
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
    ];

    if (dialect === 'postgres') {
      for (const role of roles) {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_ClubStaff_staffRole" ADD VALUE IF NOT EXISTS '${role}';`
        );
      }
      return;
    }

    await queryInterface.changeColumn('ClubStaff', 'staffRole', {
      type: Sequelize.ENUM(...roles),
      allowNull: false,
    });
  },

  down: async () => {
    // Enum value removal is not supported safely across dialects.
  },
};
