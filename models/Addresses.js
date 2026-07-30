const { DataTypes } = require("sequelize"); const sequelize = require("../config/database");
const Addresses = sequelize.define
("Addresses", 
    { id: 
        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, 
        addresses: { type: DataTypes.JSONB, allowNull: false }, 
        user: { type: DataTypes.INTEGER, allowNull: false, 
            references: { model: "users", key: "id" } } }, { tableName: "addresses", underscored: true, timestamps: true }); Addresses.associate = (models) => { Addresses.belongsTo(models.User, { foreignKey: "user" }); }
; module.exports = Addresses;
