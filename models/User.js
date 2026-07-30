const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    accountType: {
      field: "account_type",
      type: DataTypes.ENUM("Personal", "Merchant"),
      allowNull: false,
    },

    statusClient: {
      field: "status_client",
      type: DataTypes.ENUM("Active", "Inactive"),
      defaultValue: "Inactive",
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    transactionPinHash: {
      field: "transaction_pin_hash",
      type: DataTypes.STRING,
    },

    resetPasswordOtp: {
      field: "reset_password_otp",
  type: DataTypes.STRING,
  allowNull: true,
},

    hasTransactionPin: {
      field: "has_transaction_pin",
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    countryCode: {
      field: "country_code",
      type: DataTypes.STRING,
      allowNull: false,
    },

    phoneNumber: {
      field: "phone_number",
      type: DataTypes.STRING,
    },

    emailVerified: {
      field: "email_verified",
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    otp: {
      type: DataTypes.STRING,
    },

    otpExpires: {
      field: "otp_expires",
      type: DataTypes.DATE,
    },

    resetPasswordToken: {
      field: "reset_password_token",
      type: DataTypes.STRING,
    },

    resetPasswordExpires: {
      field: "reset_password_expires",
      type: DataTypes.DATE,
    },

    notification: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    firstName: {
      field: "first_name",
      type: DataTypes.STRING,
    },

    middleName: {
      field: "middle_name",
      type: DataTypes.STRING,
    },

    surname: {
      type: DataTypes.STRING,
    },

    businessName: {
      field: "business_name",
      type: DataTypes.STRING,
    },

    industry: {
      type: DataTypes.STRING,
    },

    companyAddress: {
      field: "company_address",
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = User;