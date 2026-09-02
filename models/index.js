const sequelize = require("../config/database");

const models = {
  sequelize,

  User: require("./User"),
  Wallet: require("./Wallet"),
  Transaction: require("./Transaction"),

  DepositPayment: require("./DepositPayment"),
  WithdrawalPayment: require("./WithdrawalPayment"),

  Addresses: require("./Addresses"),
  Amount: require("./Amount"),
  Balance: require("./Balance"),
  Bank: require("./Bank"),

  BkCommissions: require("./Bkcommision"),
  BkRates: require("./Bkrates"),

  CardDetails: require("./Carddetails"),
  Commission: require("./Commision"),
  Coupon: require("./Coupon"),
  CouponAssignment: require("./Couponassignment"),

  CreditMyAccountBks: require("./Creditmyaccountbks"),
  Dispatch: require("./Delivery_proof"),

  Escrow: require("./Escrow"),
  EscrowTransaction: require("./EscrowTransaction"),

  Invitation: require("./Invitation"),
  Invoice: require("./Invoice"),
  MinAmount: require("./MinAmount"),

  Notification: require("./Notification"),
  Payment: require("./Payment"),
  PaymentVerification: require("./PaymentVerification"),

  Quote: require("./Quote"),

  Rate: require("./Rate"),
  FinancialData: require("./Ratescommisions"),
  Refund: require("./Refund"),
  Request: require("./Refund_requests"),

  SecurityQuestionSet: require("./Securityquestion"),
  Total: require("./Total"),
  Transfer: require("./Transfer"),
};

models.QuoteStatus = require("./Bkquotes");

Object.values(models).forEach((model) => {
  if (model && typeof model.associate === "function") {
    model.associate(models);
  }
});

module.exports = models;