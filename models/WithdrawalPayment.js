const mongoose = require("mongoose");

const withdrawalPaymentSchema = new mongoose.Schema(
  {
    // User who requested the withdrawal
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Amount and currency
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "NGN",
    },
    refunded: {
      type: Boolean,
      default: false,
    },

    // Transaction references
    transactionRef: {
      type: String,
      required: true,
      index: { unique: true },
    },
    squadRef: {
      type: String,
      index: { unique: true, sparse: true },
    },
    idempotencyKey: {
      type: String,
      index: { unique: true, sparse: true },
    },
    flowType: {
      type: String,
      enum: ["withdrawal", "external_bank_transfer"],
      default: "withdrawal",
    },

    // Bank account details
    bankCode: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },

    // Payment status
    status: {
      type: String,
      enum: ["initiated", "pending", "processing", "success", "successful", "failed", "reversed"],
      default: "pending",
    },

    // Payment gateway data
    gatewayResponse: {
      type: Object,
    },
    gatewayResponseCode: {
      type: String,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    providerResponses: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    auditTrail: {
      type: [
        {
          status: String,
          message: String,
          metadata: mongoose.Schema.Types.Mixed,
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },

    // Transaction ID (after successful withdrawal)
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    // Metadata
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },

    // Error information
    errorMessage: {
      type: String,
    },
    errorCode: {
      type: String,
    },
  },
  { timestamps: true },
);

// Add indexes for faster querying
withdrawalPaymentSchema.index({ userId: 1, createdAt: -1 });
withdrawalPaymentSchema.index({ status: 1 });
withdrawalPaymentSchema.index({ createdAt: 1 });

const WithdrawalPayment =
  mongoose.models.WithdrawalPayment ||
  mongoose.model("WithdrawalPayment", withdrawalPaymentSchema);

module.exports = WithdrawalPayment;
