
const sequelize = require("../config/database");

const models = {
  sequelize,

  // =========================
  // USER / WALLET / TRANSACTIONS
  // =========================
  User: require("./User"),
  Wallet: require("./Wallet"),
  Transaction: require("./Transaction"),

  DepositPayment: require("./DepositPayment"),
  WithdrawalPayment: require("./WithdrawalPayment"),

  // =========================
  // USER FINANCIAL DETAILS
  // =========================
  Addresses: require("./Addresses"),
  Amount: require("./Amount"),
  Balance: require("./Balance"),
  Bank: require("./Bank"),

  // =========================
  // BUSINESS / COMMISSIONS / RATES
  // =========================
  BkCommissions: require("./Bkcommision"),
  BkRates: require("./Bkrates"),

  CardDetails: require("./Carddetails"),
  Commission: require("./Commision"),

  // =========================
  // COUPONS
  // =========================
  Coupon: require("./Coupon"),
  CouponAssignment: require("./Couponassignment"),

  // =========================
  // CREDIT / DELIVERY
  // =========================
  CreditMyAccountBks: require("./Creditmyaccountbks"),
  Dispatch: require("./Delivery_proof"),

  // =========================
  // ESCROW
  // =========================
  Escrow: require("./Escrow"),
  EscrowTransaction: require("./EscrowTransaction"),

  // =========================
  // INVITATION / INVOICE
  // =========================
  Invitation: require("./Invitation"),
  Invoice: require("./Invoice"),

  // =========================
  // OTHER MODELS
  // =========================
  MinAmount: require("./MinAmount"),

  Notification: require("./Notification"),

  Payment: require("./Payment"),
  PaymentVerification: require("./PaymentVerification"),

  // =========================
  // QUOTE / RFQ
  // =========================
  Quote: require("./Quote"),

  // =========================
  // RATES / REFUNDS / REQUESTS
  // =========================
  Rate: require("./Rate"),
  FinancialData: require("./Ratescommisions"),

  Refund: require("./Refund"),
  Request: require("./Refund_requests"),

  // =========================
  // SECURITY / TRANSFERS
  // =========================
  SecurityQuestionSet: require("./Securityquestion"),
  Total: require("./Total"),
  Transfer: require("./Transfer"),
};

// Quote status model
models.QuoteStatus = require("./Bkquotes");

// =====================================================
// INITIALIZE ALL MODEL ASSOCIATIONS
// =====================================================

Object.values(models).forEach((model) => {
  if (model && typeof model.associate === "function") {
    model.associate(models);
  }
});

// =====================================================
// DEBUG: CHECK INVOICE ASSOCIATIONS
// =====================================================

console.log(
  "Invoice associations:",
  Object.keys(models.Invoice.associations)
);

// =====================================================
// EXPORT ALL MODELS
// =====================================================

module.exports = models;

