// JonCoinTransaction model
module.exports = (sequelize, DataTypes) => {
  const JonCoinTransaction = sequelize.define('JonCoinTransaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('purchase', 'spend', 'reward', 'commission', 'withdrawal', 'refund'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
    relatedEntityType: { type: DataTypes.STRING },
    relatedEntityId: { type: DataTypes.INTEGER },
    description: { type: DataTypes.STRING },
  }, {
    tableName: 'JonCoinTransactions',
    timestamps: true
  });
  JonCoinTransaction.associate = function(models) {
    JonCoinTransaction.belongsTo(models.User, { foreignKey: 'userId' });
  };
  return JonCoinTransaction;
};
