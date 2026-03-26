const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  // Account type
  accountType: {
    type: String,
    enum: ["Personal", "Merchant"],
    required: true,
  },

  // Status
  status_client: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Inactive",
  },

  // Common fields
  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  country: {
    type: String,
    required: true,
  },
  countryCode: {
    type: String,
    required: true,
    uppercase: true,
  },

  phoneNumber: {
    type: String,
    required: function () {
      return this.accountType === "Personal";
    },
  },

  // Email verification
  emailVerified: {
    type: Boolean,
    default: false,
  },

  otp: {
    type: String,
    default: null,
  },

  otpExpires: {
    type: Date,
    default: null,
  },

  resetPasswordToken: {
    type: String,
    default: "",
  },

  resetPasswordExpires: {
    type: Date,
    default: null,
  },

  notification: {
    type: Boolean,
    default: false,
  },

  // -------- Personal Fields --------
  firstName: {
    type: String,
    required: function () {
      return this.accountType === "Personal";
    },
  },

  middleName: {
    type: String,
  },

  surname: {
    type: String,
    required: function () {
      return this.accountType === "Personal";
    },
  },

  // -------- Merchant Fields --------
  businessName: {
    type: String,
    required: function () {
      return this.accountType === "Merchant";
    },
  },

  industry: {
    type: String,
    required: function () {
      return this.accountType === "Merchant";
    },
  },

  companyAddress: {
    type: String,
    required: function () {
      return this.accountType === "Merchant";
    },
  },

  // timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
