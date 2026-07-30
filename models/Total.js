const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Total = sequelize.define("Total", { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, value: { type: DataTypes.FLOAT, allowNull: false }, currency: { type: DataTypes.STRING, allowNull: false } }, { tableName: "totals", underscored: true, timestamps: true });
Total.associate = (models) => { Total.hasMany(models.FinancialData, { foreignKey: "total_national" }); Total.hasMany(models.FinancialData, { foreignKey: "total_international" }); };
module.exports = Total;
