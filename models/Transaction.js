const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const crypto = require("crypto");

const Transaction = sequelize.define(
  "Transaction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    type: {
      type: DataTypes.ENUM(
        "transfer",
        "deposit",
        "withdrawal",
        "invoice_payment",
        "escrow_funding",
        "escrow_release"
      ),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    fee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },

    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },

    currency: {
      type: DataTypes.STRING,
      defaultValue: "NGN",
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "success",
        "completed",
        "failed",
        "reversed",
        "pending_verification",
        "processing"
      ),
      defaultValue: "pending",
    },

    senderWallet: {
      type: DataTypes.INTEGER,
      field: "sender_wallet",
    },

    senderId: {
      type: DataTypes.INTEGER,
      field: "sender_id",
    },

    recipientWallet: {
      type: DataTypes.INTEGER,
      field: "recipient_wallet",
    },

    recipientId: {
      type: DataTypes.INTEGER,
      field: "recipient_id",
    },

    reference: {
      type: DataTypes.STRING,
      unique: true,
    },

  idempotencyKey: {
  type: DataTypes.STRING,
  allowNull: false,
  unique: true,
  defaultValue: () => crypto.randomUUID(),
  field: "idempotency_key",
},
    isUserAccountTransfer: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_user_account_transfer",
    },

    staticUserUprn: {
      type: DataTypes.STRING,
      field: "static_user_uprn",
    },

    description: {
      type: DataTypes.TEXT,
    },

    externalReference: {
      type: DataTypes.STRING,
      field: "external_reference",
    },

    verificationStatus: {
      type: DataTypes.ENUM(
        "not_required",
        "pending",
        "verified",
        "failed"
      ),
      defaultValue: "not_required",
      field: "verification_status",
    },

    verificationId: {
      type: DataTypes.INTEGER,
      field: "verification_id",
    },

    paymentMethod: {
      type: DataTypes.ENUM(
        "card",
        "bank",
        "wallet",
        "cash"
      ),
      defaultValue: "wallet",
      field: "payment_method",
    },

    paymentGateway: {
      type: DataTypes.ENUM(
        "GTB",
        "Switch",
        "Internal",
        "SquadCo"
      ),
      defaultValue: "Internal",
      field: "payment_gateway",
    },

    nameOnPaymentMethod: {
      type: DataTypes.STRING,
      field: "name_on_payment_method",
    },

    failureReason: {
      type: DataTypes.TEXT,
      field: "failure_reason",
    },

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: "transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    hooks: {
      beforeValidate(transaction) {
        transaction.amount = Number(transaction.amount || 0);
        transaction.fee = Number(transaction.fee || 0);
        transaction.total = transaction.amount + transaction.fee;

        if (
          transaction.isUserAccountTransfer &&
          !transaction.reference
        ) {
          throw new Error(
            "Reference (UPRN) is required for user account transfers."
          );
        }
      },
    },
  }
);

module.exports = Transaction;