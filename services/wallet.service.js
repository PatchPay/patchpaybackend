const Wallet = require("../models/Wallet");

const getActiveWalletForUser = async (userId, session = null) => {
  const query = Wallet.findOne({ userId, isActive: true });
  if (session) query.session(session);
  return query;
};

const getActiveWalletByAccountNumber = async (accountNumber, session = null) => {
  const query = Wallet.findOne({ accountNumber, isActive: true });
  if (session) query.session(session);
  return query;
};

const debitWallet = async ({ walletId, amount, session }) => {
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      isActive: true,
      balance: { $gte: amount },
    },
    {
      $inc: { balance: -amount },
    },
    {
      new: true,
      session,
    },
  );

  if (!updatedWallet) {
    const error = new Error("Insufficient balance");
    error.statusCode = 400;
    throw error;
  }

  return updatedWallet;
};

const creditWallet = async ({ walletId, amount, session }) => {
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      isActive: true,
    },
    {
      $inc: { balance: amount },
    },
    {
      new: true,
      session,
    },
  );

  if (!updatedWallet) {
    const error = new Error("Wallet not found");
    error.statusCode = 404;
    throw error;
  }

  return updatedWallet;
};

module.exports = {
  creditWallet,
  debitWallet,
  getActiveWalletByAccountNumber,
  getActiveWalletForUser,
};
