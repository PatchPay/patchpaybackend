const { DataTypes } = require("sequelize"); const sequelize = require("../config/database");
const QuoteHistory = sequelize.define("QuoteHistory", { 
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }
    , quote: 
    { type: DataTypes.INTEGER, allowNull: false, references: { model: "quotes", key: "id" } }
    , user_data: 
    { type: DataTypes.JSONB, allowNull: false }
    , status: { type: DataTypes.ENUM("Pending", "Accepted", "Rejected", "Cancelled", "Deleted"), allowNull: false }, action: { type: DataTypes.STRING, allowNull: false }, notificationDue: { type: DataTypes.DATE, field: "notification_due" }, notificationSent: { type: DataTypes.BOOLEAN, defaultValue: false, field: "notification_sent" }, deletionDue: { type: DataTypes.DATE, field: "deletion_due" }, deletionNotificationSent: { type: DataTypes.BOOLEAN, defaultValue: false, field: "deletion_notification_sent" }, deletedAt: { type: DataTypes.DATE, field: "deleted_at" } }, { tableName: "quote_histories", underscored: true, timestamps: true, updatedAt: false, indexes: [{ fields: ["notification_due"] }, { fields: ["deletion_due"] }, { fields: ["quote", "created_at"] }] }); QuoteHistory.associate = (models) => { QuoteHistory.belongsTo(models.Quote, { foreignKey: "quote" }); }; module.exports = QuoteHistory;
