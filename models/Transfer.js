const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Transfer = sequelize.define(
  "Transfer",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code_transfer: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("Refund", "Pending", "Completed"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "transfers",
    underscored: true,
    timestamps: true,
  }
);

Transfer.associate = (models) => {
  Transfer.belongsTo(models.User, {
    foreignKey: "user",
  });
};

module.exports = Transfer;