const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Tournament } = require('./Tournament');
const Match = require('./Match');

const Bracket = sequelize.define('Bracket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    references: {
      model: Tournament,
      key: 'id',
    },
  },
  round: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  position: {
    type: DataTypes.INTEGER, // Position in the round
  },
  matchId: {
    type: DataTypes.INTEGER,
    references: {
      model: Match,
      key: 'id',
    },
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Bracket.belongsTo(Tournament, { foreignKey: 'tournamentId' });
Tournament.hasMany(Bracket, { foreignKey: 'tournamentId' });

Bracket.belongsTo(Match, { foreignKey: 'matchId' });
Match.hasOne(Bracket, { foreignKey: 'matchId' });

module.exports = Bracket;