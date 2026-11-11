const { Op } = require("sequelize");
const AccountBalance = require("../models/AccountBalance");
const sequelize = require("../config/database");

function decimalAmount(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Invalid monetary amount");
  const [whole, fraction = ""] = text.split(".");
  if (whole.length > 13) throw new Error("Monetary amount exceeds supported precision");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Invalid monetary amount");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

async function findOrCreateLocked({ userId, currency = "NGN", transaction }) {
  const [row] = await AccountBalance.findOrCreate({
    where: { userId, currency },
    defaults: { userId, currency, balance: "0.00" },
    transaction,
  });
  return AccountBalance.findByPk(row.id, { transaction, lock: transaction?.LOCK.UPDATE });
}

async function debitAccountBalance({ userId, currency = "NGN", amount, transaction }) {
  const value = decimalAmount(amount);
  const row = await findOrCreateLocked({ userId, currency, transaction });
  const [count] = await AccountBalance.update(
    { balance: sequelize.literal(`balance - ${value}`) },
    { where: { id: row.id, balance: { [Op.gte]: value } }, transaction },
  );
  if (!count) { const error = new Error("Insufficient account balance"); error.statusCode = 400; throw error; }
  return AccountBalance.findByPk(row.id, { transaction });
}

async function creditAccountBalance({ userId, currency = "NGN", amount, transaction }) {
  const value = decimalAmount(amount);
  const row = await findOrCreateLocked({ userId, currency, transaction });
  await row.update({ balance: sequelize.literal(`balance + ${value}`) }, { transaction });
  return AccountBalance.findByPk(row.id, { transaction });
}

module.exports = { creditAccountBalance, debitAccountBalance, findOrCreateLocked, decimalAmount };
