const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema(
  {
    bankCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      default: "NG",
    },
    active: {
      type: Boolean,
      default: true,
    },
    raw: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

bankSchema.index({ active: 1, bankCode: 1 });

const Bank = mongoose.models.Bank || mongoose.model("Bank", bankSchema);
module.exports = Bank;
