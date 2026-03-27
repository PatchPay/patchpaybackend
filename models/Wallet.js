const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ["personal", "merchant", "ngo", "government"],
      default: "personal",
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: [
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
        "PEN",
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Create a compound index to ensure a user can have multiple wallets but only one per account type
walletSchema.index({ userId: 1, accountType: 1 }, { unique: true });

// Add a check to prevent model compilation errors
module.exports =
  mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
