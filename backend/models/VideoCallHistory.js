// Sequelize model for storing video call history (multi-user, advanced)
module.exports = (sequelize, DataTypes) => {
  const VideoCallHistory = sequelize.define('VideoCallHistory', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    roomId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    participants: {
      type: DataTypes.JSONB, // Array of userIds
      allowNull: false
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('completed', 'missed', 'rejected', 'cancelled'),
      defaultValue: 'completed'
    }
  });
  return VideoCallHistory;
};
