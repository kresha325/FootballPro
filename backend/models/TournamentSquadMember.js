const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

/**
 * Athletes nominated by a club for a club/mixed tournament.
 * Standings use TournamentParticipant (club account only for participantType=club).
 */
const TournamentSquadMember = sequelize.define(
  'TournamentSquadMember',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tournamentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clubUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
    athleteUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'id' },
    },
  },
  {
    tableName: 'TournamentSquadMembers',
    indexes: [
      { unique: true, fields: ['tournamentId', 'athleteUserId'] },
      { fields: ['tournamentId', 'clubUserId'] },
      { fields: ['athleteUserId'] },
    ],
  }
);

TournamentSquadMember.belongsTo(User, { foreignKey: 'clubUserId', as: 'club' });
TournamentSquadMember.belongsTo(User, { foreignKey: 'athleteUserId', as: 'athlete' });

module.exports = TournamentSquadMember;
