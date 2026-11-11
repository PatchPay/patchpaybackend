const sequelize = require("../config/database");
const Wallet = require("../models/Wallet");
const AccountBalance = require("../models/AccountBalance");
const Transaction = require("../models/Transaction");
const crypto = require("crypto");

function toCents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const asAmount = (cents) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

async function transfer({ userId, amount, direction, idempotencyKey }) {
  const cents = toCents(amount);
  if (!cents) {
    const error = new Error("Amount must be a positive amount with at most two decimal places");
    error.statusCode = 400;
    throw error;
  }

  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({
      where: { userId, isActive: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
      order: [["id", "ASC"]],
    });
    if (!wallet) {
      const error = new Error("Active wallet not found"); error.statusCode = 404; throw error;
    }

    const requestKey = idempotencyKey ? String(idempotencyKey).trim() : null;
    if (requestKey && (requestKey.length > 128 || requestKey.length < 8)) {
      const error = new Error("Idempotency key must be between 8 and 128 characters"); error.statusCode = 400; throw error;
    }
    if (requestKey) {
      const prior = await Transaction.findOne({ where: { idempotencyKey: requestKey }, transaction: t });
      if (prior) {
        if (prior.type !== direction || String(prior.senderId || prior.recipientId) !== String(userId) || String(prior.amount) !== asAmount(cents)) {
          const error = new Error("Idempotency key has already been used"); error.statusCode = 409; throw error;
        }
        return {
          accountBalance: prior.metadata.accountBalanceAfter,
          walletBalance: prior.metadata.walletBalanceAfter,
          currency: prior.currency,
          transaction: prior,
          replayed: true,
        };
      }
    }

    let [account] = await AccountBalance.findOrCreate({
      where: { userId, currency: wallet.currency },
      defaults: { userId, currency: wallet.currency, balance: "0.00" },
      transaction: t,
    });
    account = await AccountBalance.findByPk(account.id, { transaction: t, lock: t.LOCK.UPDATE });

    const walletCents = Math.round(Number(wallet.balance) * 100);
    const accountCents = Math.round(Number(account.balance) * 100);
    const fromAccount = direction === "account_to_wallet";
    const sourceCents = fromAccount ? accountCents : walletCents;
    if (sourceCents < cents) {
      const error = new Error(`Insufficient ${fromAccount ? "account" : "wallet"} balance`);
      error.statusCode = 400; throw error;
    }

    const nextAccount = accountCents + (fromAccount ? -cents : cents);
    const nextWallet = walletCents + (fromAccount ? cents : -cents);
    await account.update({ balance: asAmount(nextAccount) }, { transaction: t });
    await wallet.update({ balance: asAmount(nextWallet) }, { transaction: t });

    const reference = `BAL-${crypto.randomUUID()}`;
    const transaction = await Transaction.create({
      type: direction,
      amount: asAmount(cents),
      fee: "0.00",
      total: asAmount(cents),
      currency: wallet.currency,
      status: "success",
      senderId: fromAccount ? userId : null,
      senderWallet: fromAccount ? null : wallet.id,
      recipientId: fromAccount ? userId : null,
      recipientWallet: fromAccount ? wallet.id : null,
      reference,
      idempotencyKey: requestKey || reference,
      isUserAccountTransfer: false,
      description: fromAccount ? "Account balance transferred to wallet" : "Wallet balance transferred to account",
      metadata: { balanceTransfer: direction, accountBalanceAfter: asAmount(nextAccount), walletBalanceAfter: asAmount(nextWallet) },
    }, { transaction: t });

    return { accountBalance: asAmount(nextAccount), walletBalance: asAmount(nextWallet), currency: wallet.currency, transaction, replayed: false };
  });
}

module.exports = { transfer, toCents };
