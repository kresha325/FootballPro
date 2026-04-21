/**
 * Skema e turneut: kush lejohet të bashkohet.
 * Vlerat e aplikacionit: `individual` | `club` | `mixed` (të gjitha në këtë kolonë STRING).
 * Çdo ndryshim i ri në DB për këtë tabelë duhet të kalojë përmes migracionesh, jo sequelize.sync.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Tournaments').catch(() => null);
    if (!desc || desc.participantType) return;

    await queryInterface.addColumn('Tournaments', 'participantType', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'individual',
    });
  },

  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('Tournaments').catch(() => null);
    if (!desc || !desc.participantType) return;
    await queryInterface.removeColumn('Tournaments', 'participantType');
  },
};
