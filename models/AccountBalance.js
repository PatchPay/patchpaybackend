const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AccountBalance = sequelize.define("AccountBalance", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id", references: { model: "users", key: "id" } },
  currency: { type: DataTypes.STRING(10), allowNull: false },
  balance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: "0.00" },
}, {
  tableName: "account_balances",
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ["user_id", "currency"] }],
});

AccountBalance.associate = (models) => AccountBalance.belongsTo(models.User, { foreignKey: "userId" });
module.exports = AccountBalance;
