const { Op } = require("sequelize");
const Wallet = require("../models/Wallet");

const getActiveWalletForUser = async (userId, transaction = null) => {
  return Wallet.findOne({
    where: { userId, isActive: true },
    transaction,
  });
};

const getActiveWalletByAccountNumber = async (accountNumber, transaction = null) => {
  return Wallet.findOne({
    where: { accountNumber, isActive: true },
    transaction,
  });
};

const debitWallet = async ({ walletId, amount, transaction }) => {
  const [affectedCount, affectedRows] = await Wallet.update(
    {
      balance: Wallet.sequelize.literal(`balance - ${amount}`),
    },
    {
      where: {
        id: walletId,
        isActive: true,
        balance: { [Op.gte]: amount },
      },
      transaction,
      returning: true, // works on Postgres/MSSQL; ignored on MySQL/SQLite
    },
  );

  if (!affectedCount) {
    const error = new Error("Insufficient balance");
    error.statusCode = 400;
    throw error;
  }

  // Fallback for dialects without RETURNING support (MySQL/SQLite)
  const updatedWallet =
    affectedRows && affectedRows.length
      ? affectedRows[0]
      : await Wallet.findByPk(walletId, { transaction });

  return updatedWallet;
};

const creditWallet = async ({ walletId, amount, transaction }) => {
  const [affectedCount, affectedRows] = await Wallet.update(
    {
      balance: Wallet.sequelize.literal(`balance + ${amount}`),
    },
    {
      where: {
        id: walletId,
        isActive: true,
      },
      transaction,
      returning: true,
    },
  );

  if (!affectedCount) {
    const error = new Error("Wallet not found");
    error.statusCode = 404;
    throw error;
  }

  const updatedWallet =
    affectedRows && affectedRows.length
      ? affectedRows[0]
      : await Wallet.findByPk(walletId, { transaction });

  return updatedWallet;
};

module.exports = {
  creditWallet,
  debitWallet,
  getActiveWalletByAccountNumber,
  getActiveWalletForUser,
};