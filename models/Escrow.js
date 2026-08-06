const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Escrow = sequelize.define(
  "Escrow",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "creator_id",
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

    currentBalance: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      field: "current_balance",
    },

    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "NGN",
    },

    status: {
      type: DataTypes.ENUM(
        "CREATED",
        "PARTIALLY_FUNDED",
        "FUNDED",
        "RELEASED",
        "REFUNDED",
        "DISPUTED",
        "CANCELLED"
      ),
      defaultValue: "CREATED",
    },

    escrowUprn: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "escrow_uprn",
    },

    fundingTransactionId: {
      type: DataTypes.INTEGER,
      field: "funding_transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    releaseTransactionId: {
      type: DataTypes.INTEGER,
      field: "release_transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    refundTransactionId: {
      type: DataTypes.INTEGER,
      field: "refund_transaction_id",
      references: {
        model: "transactions",
        key: "id",
      },
    },

    conditions: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    expiryDate: {
      type: DataTypes.DATE,
      field: "expiry_date",
    },

    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

    outstandingBalance: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.amount - (this.currentBalance || 0);
      },
    },
  },
  {
    tableName: "escrows",
    underscored: true,
    timestamps: true,

    indexes: [
      {
        fields: ["creator_id", "created_at"],
      },
      {
        fields: ["recipient_id", "status"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["expiry_date"],
      },
    ],
  }
);

Escrow.associate = (models) => {
  Escrow.belongsTo(models.User, {
    as: "creator",
    foreignKey: "creatorId",
  });

  Escrow.belongsTo(models.User, {
    as: "recipient",
    foreignKey: "recipientId",
  });

  Escrow.belongsTo(models.Transaction, {
    as: "fundingTransaction",
    foreignKey: "fundingTransactionId",
  });

  Escrow.belongsTo(models.Transaction, {
    as: "releaseTransaction",
    foreignKey: "releaseTransactionId",
  });

  Escrow.belongsTo(models.Transaction, {
    as: "refundTransaction",
    foreignKey: "refundTransactionId",
  });

  Escrow.hasMany(models.EscrowTransaction, {
    foreignKey: "escrowId",
  });
};

module.exports = Escrow;