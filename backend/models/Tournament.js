const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: DataTypes.TEXT,
  type: {
    type: DataTypes.ENUM('league', 'cup', 'knockout'),
    allowNull: false,
  },
  /** Liga: sezon FIFA YYYY/(Y+1); kupë/knockout: viti i edicionit */
  season: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  startDate: DataTypes.DATE,
  endDate: DataTypes.DATE,
  maxParticipants: DataTypes.INTEGER,
  status: {
    type: DataTypes.ENUM('open', 'ongoing', 'finished'),
    defaultValue: 'open',
  },
  /** `individual` = jo-klub; `club` = vetëm klube; `mixed` = klube + athletë në të njëjtin turne. */
  participantType: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'individual',
    validate: { isIn: [['individual', 'club', 'mixed']] },
  },
  creatorId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  /** Linked liga when tournament was created for / by a liga profile. */
  ligaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  /** Who created it: liga | club | scout */
  sourceRole: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  /** Age/competition band for this edition (open, u11, u10, …). */
  category: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'open',
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

Tournament.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });
User.hasMany(Tournament, { foreignKey: 'creatorId' });

// Many-to-many with participants
const TournamentParticipant = sequelize.define('TournamentParticipant', {
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
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  wins: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  draws: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  losses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  goalsFor: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  goalsAgainst: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending',
  },
});

Tournament.belongsToMany(User, { through: TournamentParticipant, foreignKey: 'tournamentId', as: 'participants' });
User.belongsToMany(Tournament, { through: TournamentParticipant, foreignKey: 'userId', as: 'tournaments' });
TournamentParticipant.belongsTo(User, { foreignKey: 'userId' });
TournamentParticipant.belongsTo(Tournament, { foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentParticipant, { foreignKey: 'tournamentId' });

module.exports = { Tournament, TournamentParticipant };