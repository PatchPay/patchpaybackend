const { Op } = require("sequelize");
const Wallet = require("../models/Wallet");

const amountText = (amount) => {
  const text = String(amount ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Amount must have at most two decimal places");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Amount must be positive and within supported precision");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
};

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

const debitWallet = async ({ walletId, amount, transaction, debitAvailable = true }) => {
  const value = amountText(amount);
  const values = { balance: Wallet.sequelize.literal(`balance - ${value}`) };
  if (debitAvailable) values.availableBalance = Wallet.sequelize.literal(`available_balance - ${value}`);
  const [affectedCount, affectedRows] = await Wallet.update(
    values,
    {
      where: {
        id: walletId,
        isActive: true,
        balance: { [Op.gte]: value },
        ...(debitAvailable ? { availableBalance: { [Op.gte]: value } } : {}),
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

const creditWallet = async ({ walletId, amount, transaction, creditAvailable = true }) => {
  const value = amountText(amount);
  const values = { balance: Wallet.sequelize.literal(`balance + ${value}`) };
  if (creditAvailable) values.availableBalance = Wallet.sequelize.literal(`available_balance + ${value}`);
  const [affectedCount, affectedRows] = await Wallet.update(
    values,
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

const debitAvailableBalance = async ({ walletId, amount, transaction }) => {
  const value = amountText(amount);
  const [affectedCount, affectedRows] = await Wallet.update(
    { availableBalance: Wallet.sequelize.literal(`available_balance - ${value}`) },
    { where: { id: walletId, isActive: true, availableBalance: { [Op.gte]: value } }, transaction, returning: true },
  );
  if (!affectedCount) {
    const error = new Error("Insufficient available balance");
    error.statusCode = 400;
    throw error;
  }
  return affectedRows?.[0] || Wallet.findByPk(walletId, { transaction });
};

module.exports = {
  creditWallet,
  debitWallet,
  debitAvailableBalance,
  getActiveWalletByAccountNumber,
  getActiveWalletForUser,
};
