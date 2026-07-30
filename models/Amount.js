const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Amount = sequelize.define("Amount", { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, value: { type: DataTypes.FLOAT, allowNull: false }, currency: { type: DataTypes.STRING, allowNull: false } }, { tableName: "amounts", underscored: true, timestamps: true });
Amount.associate = (models) => { Amount.hasMany(models.Balance, { foreignKey: "balance" }); Amount.hasMany(models.Balance, { foreignKey: "available_balance" }); };
module.exports = Amount;
