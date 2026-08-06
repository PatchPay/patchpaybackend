const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Invoice = sequelize.define(
  "Invoice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    rfqId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: "rfq_id",
      references: {
        model: "quotes",
        key: "id",
      },
    },

    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "requester_id",
      references: {
        model: "users",
        key: "id",
      },
    },

    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "recipient_id",
      references: {
        model: "users",
        key: "id",
      },
    },

    amount: {
      type: DataTypes.FLOAT,
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

    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("pending", "paid", "cancelled"),
      defaultValue: "pending",
    },

    paymentStatus: {
      type: DataTypes.ENUM("unpaid", "pending", "paid", "failed"),
      defaultValue: "unpaid",
      field: "payment_status",
    },

    paymentReference: {
      type: DataTypes.STRING,
      unique: true,
      field: "payment_reference",
    },

    squadRef: {
      type: DataTypes.STRING,
      unique: true,
      field: "squad_ref",
    },

    checkoutUrl: {
      type: DataTypes.STRING,
      field: "checkout_url",
    },

    paidAt: {
      type: DataTypes.DATE,
      field: "paid_at",
    },

    verifiedAt: {
      type: DataTypes.DATE,
      field: "verified_at",
    },

    gatewayResponse: {
      type: DataTypes.JSONB,
      field: "gateway_response",
    },

    escrowId: {
      type: DataTypes.INTEGER,
      field: "escrow_id",
      references: {
        model: "escrows",
        key: "id",
      },
    },

    fundingTransactionId: {
      type: DataTypes.INTEGER,
      field: "funding_transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    escrowFundingTransactionId: {
      type: DataTypes.INTEGER,
      field: "escrow_funding_transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: "invoices",
    underscored: true,
    timestamps: true,

    indexes: [
      {
        fields: ["requester_id", "created_at"],
      },
      {
        fields: ["recipient_id", "created_at"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["payment_status"],
      },
    ],
  }
);

Invoice.associate = (models) => {
  Invoice.belongsTo(models.Quote, {
    as: "rfq",
    foreignKey: "rfqId",
  });

  Invoice.belongsTo(models.User, {
    as: "requester",
    foreignKey: "requesterId",
  });

  Invoice.belongsTo(models.User, {
    as: "recipient",
    foreignKey: "recipientId",
  });

  Invoice.belongsTo(models.Escrow, {
    foreignKey: "escrowId",
  });

  Invoice.belongsTo(models.Transaction, {
    as: "fundingTransaction",
    foreignKey: "fundingTransactionId",
  });

  Invoice.belongsTo(models.Transaction, {
    as: "escrowFundingTransaction",
    foreignKey: "escrowFundingTransactionId",
  });
};

module.exports = Invoice;