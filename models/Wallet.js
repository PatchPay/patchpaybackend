const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Wallet = sequelize.define(
  "Wallet",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
    },

    accountType: {
      type: DataTypes.ENUM(
        "personal",
        "merchant",
        "ngo",
        "government"
      ),
      allowNull: false,
      defaultValue: "personal",
      field: "account_type",
    },

    accountNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "account_number",
    },

    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },

    currency: {
      type: DataTypes.ENUM(
        "NGN",
        "GHS",
        "KES",
        "ZAR",
        "EGP",
        "UGX",
        "TZS",
        "RWF",
        "ETB",
        "XAF",
        "XOF",
        "DZD",
        "MAD",
        "GBP",
        "EUR",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "PLN",
        "USD",
        "CAD",
        "MXN",
        "CNY",
        "JPY",
        "INR",
        "SGD",
        "AED",
        "SAR",
        "QAR",
        "ILS",
        "KRW",
        "THB",
        "MYR",
        "IDR",
        "PKR",
        "PHP",
        "VND",
        "AUD",
        "NZD",
        "BRL",
        "ARS",
        "CLP",
        "COP",
        "PEN"
      ),
      allowNull: false,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "wallets",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Wallet;