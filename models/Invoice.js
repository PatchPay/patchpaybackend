const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      required: true,
      unique: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      default: "unpaid",
      index: true,
    },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    squadRef: {
      type: String,
      unique: true,
      sparse: true,
    },
    checkoutUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    escrowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Escrow",
    },
    fundingTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    escrowFundingTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

invoiceSchema.index({ requesterId: 1, createdAt: -1 });
invoiceSchema.index({ recipientId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
