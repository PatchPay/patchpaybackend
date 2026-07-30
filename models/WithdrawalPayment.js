const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WithdrawalPayment = sequelize.define(
  "WithdrawalPayment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      field: "user_id",
      type: DataTypes.INTEGER,
      allowNull: false,
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
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "NGN",
    },

    refunded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    transactionRef: {
      field: "transaction_ref",
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    squadRef: {
      field: "squad_ref",
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },

    idempotencyKey: {
      field: "idempotency_key",
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },

    flowType: {
      field: "flow_type",
      type: DataTypes.ENUM(
        "withdrawal",
        "external_bank_transfer"
      ),
      defaultValue: "withdrawal",
    },

    bankCode: {
      field: "bank_code",
      type: DataTypes.STRING,
      allowNull: false,
    },

    accountNumber: {
      field: "account_number",
      type: DataTypes.STRING,
      allowNull: false,
    },

    accountName: {
      field: "account_name",
      type: DataTypes.STRING,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "initiated",
        "pending",
        "processing",
        "success",
        "successful",
        "failed",
        "reversed"
      ),
      defaultValue: "pending",
    },

   gatewayResponse: {
  field: "gateway_response",
  type: DataTypes.JSONB,
  allowNull: true,
},

gatewayResponseCode: {
  field: "gateway_response_code",
  type: DataTypes.STRING,
},

providerResponses: {
  field: "provider_responses",
  type: DataTypes.JSONB,
  defaultValue: [],
},

auditTrail: {
  field: "audit_trail",
  type: DataTypes.JSONB,
  defaultValue: [],
},

ipAddress: {
  field: "ip_address",
  type: DataTypes.STRING,
},

userAgent: {
  field: "user_agent",
  type: DataTypes.TEXT,
},

errorMessage: {
  field: "error_message",
  type: DataTypes.TEXT,
},

errorCode: {
  field: "error_code",
  type: DataTypes.STRING,
},

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

 

    transactionId: {
        field: "transaction_id",
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "transactions",
        key: "id",
      },
    },




  },
  {
    tableName: "withdrawal_payments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = WithdrawalPayment;