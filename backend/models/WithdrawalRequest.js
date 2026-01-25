// WithdrawalRequest model
module.exports = (sequelize, DataTypes) => {
  const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
  }, {
    tableName: 'WithdrawalRequests',
    timestamps: true
  });
  WithdrawalRequest.associate = function(models) {
    WithdrawalRequest.belongsTo(models.User, { foreignKey: 'userId' });
  };
  return WithdrawalRequest;
};
