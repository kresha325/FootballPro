// JonCoinTransaction model
module.exports = (sequelize, DataTypes) => {
  const JonCoinTransaction = sequelize.define('JonCoinTransaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM(
        'purchase', 'spend', 'reward', 'commission', 'withdrawal', 'refund',
        'sale', 'subscription', 'reversal', 'fee'
      ),
      allowNull: false,
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'JON' },
    balanceBefore: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    balanceAfter: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
    relatedEntityType: { type: DataTypes.STRING },
    relatedEntityId: { type: DataTypes.INTEGER },
    description: { type: DataTypes.STRING },
    idempotencyKey: { type: DataTypes.STRING(191), allowNull: true, unique: true },
  }, {
    tableName: 'JonCoinTransactions',
    timestamps: true
  });
  JonCoinTransaction.associate = function(models) {
    JonCoinTransaction.belongsTo(models.User, { foreignKey: 'userId' });
  };
  return JonCoinTransaction;
};
