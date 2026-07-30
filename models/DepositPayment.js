const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DepositPayment = sequelize.define(
  "DepositPayment",
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

    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
    },

    transactionRef: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "transaction_ref",
    },

    squadRef: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      field: "squad_ref",
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "successful",
        "failed",
        "reversed"
      ),
      defaultValue: "pending",
    },

    gatewayResponse: {
      type: DataTypes.JSONB,
      field: "gateway_response",
    },

    gatewayResponseCode: {
      type: DataTypes.STRING,
      field: "gateway_response_code",
    },

    transactionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    ipAddress: {
      type: DataTypes.STRING,
      field: "ip_address",
    },

    userAgent: {
      type: DataTypes.TEXT,
      field: "user_agent",
    },

    errorMessage: {
      type: DataTypes.TEXT,
      field: "error_message",
    },

    errorCode: {
      type: DataTypes.STRING,
      field: "error_code",
    },
  },
  {
    tableName: "deposit_payments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = DepositPayment;