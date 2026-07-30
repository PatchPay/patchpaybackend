const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Commission = sequelize.define("Commission", { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, commission_squad: { type: DataTypes.FLOAT, allowNull: false }, commission_stripe: { type: DataTypes.FLOAT, allowNull: false } }, { tableName: "commissions", underscored: true, timestamps: true });
Commission.associate = (models) => { Commission.hasMany(models.FinancialData, { foreignKey: "commissions_national" }); Commission.hasMany(models.FinancialData, { foreignKey: "commissions_international" }); };
module.exports = Commission;
