const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Quote = sequelize.define(
  "Quote",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    quote_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    type: {
      type: DataTypes.ENUM("RFQ", "Order"),
      allowNull: false,
    },

    product_description: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    product_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    currency: {
      type: DataTypes.ENUM("NGN", "USD", "GBP"),
      allowNull: false,
    },

    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    uprn: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "Pending",
        "Accepted",
        "Rejected",
        "Cancelled",
        "Funded",
        "Completed"
      ),
      defaultValue: "Pending",
    },

    user_data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },

    destinatary_user: {
      type: DataTypes.JSONB,
      allowNull: false,
    },

    delivery_code: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    delivery_type: {
      type: DataTypes.ENUM("Standard", "Secure"),
      allowNull: false,
    },

    trade_type: {
      type: DataTypes.ENUM("Domestic", "International"),
      allowNull: false,
    },

    delivery_address: {
      type: DataTypes.JSONB,
      allowNull: false,
    },

    arrival_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    arrival_time: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    line_total: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    delivery_charge: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    transaction_charges: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    subtotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    proof_delivery: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    coupon: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },

    exchange_rate: {
      type: DataTypes.FLOAT,
      defaultValue: 1,
    },

    responseNotificationDue: {
      field: "response_notification_due",
      type: DataTypes.DATE,
    },

    notificationSent: {
      field: "notification_sent",
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    deletionNotificationSent: {
      field: "deletion_notification_sent",
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    invoice: {
      type: DataTypes.INTEGER,
      references: {
        model: "invoices",
        key: "id",
      },
    },
  },
  {
    tableName: "quotes",
    underscored: true,
    timestamps: true,

    indexes: [
      {
        fields: [
          "status",
          "response_notification_due",
          "notification_sent",
        ],
      },
      {
        fields: [
          "status",
          "updated_at",
          "deletion_notification_sent",
        ],
      },
    ],
  }
);

Quote.associate = (models) => {
  Quote.belongsTo(models.Invoice, {
    foreignKey: "invoice",
  });

  Quote.hasMany(models.QuoteStatus, {
    foreignKey: "quote",
  });

  Quote.hasMany(models.QuoteHistory, {
    foreignKey: "quote",
  });

  Quote.hasMany(models.Request, {
    foreignKey: "quote_number",
  });

  Quote.belongsToMany(models.Coupon, {
    through: "quote_coupons",
    foreignKey: "quote_id",
    otherKey: "coupon_id",
  });
};

module.exports = Quote;