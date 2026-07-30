const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const WithdrawalPayment = require("../models/WithdrawalPayment");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const squadApi = require("../utils/squadApiUtils");
const bankService = require("./bankService");
const { generateUPRN, validateNameMatch } = require("../utils/paymentUtils");

const SQUAD_MERCHANT_ID = process.env.SQUAD_MERCHANT_ID || "";

const normalizeStatus = (squadStatus) => {
  const status = String(squadStatus || "").toLowerCase();
  if (["successful", "success", "completed"].includes(status)) return "successful";
  if (["reversed", "reverse"].includes(status)) return "reversed";
  if (["failed", "failure", "declined", "rejected"].includes(status)) return "failed";
  if (["processing", "pending", "pending_requery"].includes(status)) return "processing";
  return "processing";
};

const verifyTransactionPin = async (user, transactionPin) => {
  if (!transactionPin) {
    throw new Error("Transaction PIN is required for this operation");
  }

  if (!user.transactionPinHash) {
    throw new Error("Transaction PIN is not configured for this account");
  }

  const isValidPin = await bcrypt.compare(transactionPin, user.transactionPinHash);
  if (!isValidPin) {
    throw new Error("Invalid transaction PIN");
  }
};

exports.initiateWithdrawal = async ({
  user,
  amount,
  bankCode,
  accountNumber,
  accountName,
  description,
  transactionPin,
  idempotencyKey,
  ipAddress,
  userAgent,
  flowType = "withdrawal",
}) => {
  const transactionDb = await sequelize.transaction();

  try {
    if (!amount || Number(amount) <= 0) {
      throw new Error("Please provide a valid amount");
    }
    if (!bankCode || !accountNumber || !accountName) {
      throw new Error("Bank details are required");
    }

    await verifyTransactionPin(user, transactionPin);

    const bank = await bankService.getBankByCode(bankCode);
    if (!bank || !bank.active) {
      throw new Error("Selected bank is not available for payouts");
    }

    const wallet = await Wallet.findOne({ where: { userId: user.id }, transaction: transactionDb });
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    if (wallet.currency !== "NGN") {
      throw new Error("Withdrawals are only supported in NGN");
    }
    if (Number(wallet.balance) < Number(amount)) {
      throw new Error("Insufficient balance");
    }

    if (idempotencyKey) {
      const existing = await WithdrawalPayment.findOne({ where: { idempotencyKey }, transaction: transactionDb });
      if (existing) {
        await transactionDb.commit();
        return { existing, repeated: true };
      }
    }

    const accountLookup = await squadApi.lookupAccount({ bankCode, accountNumber });
    if (!accountLookup || !accountLookup.success || !accountLookup.data) {
      throw new Error("Unable to verify bank account");
    }

    const resolvedAccountName = accountLookup.data.account_name || "";
    if (!validateNameMatch(accountName, resolvedAccountName)) {
      throw new Error("Account name mismatch");
    }

    const withdrawalUprn = generateUPRN(user.id, "withdrawal");
    const transactionRef = `${SQUAD_MERCHANT_ID.trim() || "MERCHANT"}_${Date.now()}`;

    const withdrawalPayment = await WithdrawalPayment.create({
      userId: user.id,
      amount,
      currency: "NGN",
      transactionRef,
      squadRef: null,
      bankCode,
      accountNumber,
      accountName: resolvedAccountName,
      status: "pending",
      idempotencyKey: idempotencyKey || undefined,
      ipAddress,
      userAgent,
      flowType,
      metadata: {
        flowType,
        bankName: bank?.name || null,
      },
    }, { transaction: transactionDb });

    const transaction = await Transaction.create({
      senderId: user.id,
      senderWallet: wallet.id,
      total: Number(amount),
      amount: Number(amount),
      currency: "NGN",
      type: "withdrawal",
      status: "pending",
      reference: withdrawalUprn,
      isUserAccountTransfer: true,
      description: description || "Withdrawal from wallet",
      paymentMethod: "bank",
      paymentGateway: "SquadCo",
      metadata: {
        withdrawalDetails: {
          accountName: resolvedAccountName,
          accountNumber,
          bankCode,
          bankName: bank?.name,
        },
        transactionRef,
        flowType,
      },
    });


    wallet.balance -= Number(amount);
    await wallet.save({ transaction: transactionDb });

    const withdrawalPayload = {
      amount: Number(amount),
      bankCode,
      accountNumber,
      accountName: resolvedAccountName,
      transactionRef,
      description: description || "Wallet withdrawal",
    };

    const squadResponse = await squadApi.initiateWithdrawal(withdrawalPayload);

    withdrawalPayment.gatewayResponse = squadResponse;
    const nipReference = squadResponse?.data?.nip_transaction_reference || squadResponse?.data?.transaction_reference || null;
    withdrawalPayment.squadRef = nipReference;
    transaction.externalReference = nipReference;

    const payoutStatus = normalizeStatus(squadResponse?.data?.status || "processing");
    withdrawalPayment.status = payoutStatus === "successful" ? "successful" : "processing";
    transaction.status = payoutStatus === "successful" ? "completed" : "processing";

    await withdrawalPayment.save({ transaction: transactionDb });
    await transaction.save({ transaction: transactionDb });
    await transactionDb.commit();

    return {
      withdrawal: withdrawalPayment,
      transaction,
      repeated: false,
    };
  } catch (error) {
    try {
      await transactionDb.rollback();
    } catch (abortError) {
      console.error("Abort transaction error:", abortError);
    }
    throw error;
  }
};

exports.verifyWithdrawalStatus = async (transactionRef) => {
  const withdrawalPayment = await WithdrawalPayment.findOne({ where: { transactionRef } });
  if (!withdrawalPayment) {
    throw new Error("Withdrawal not found");
  }

  if (["successful", "failed", "reversed"].includes(withdrawalPayment.status)) {
    const transaction = await Transaction.findOne({ where: sequelize.where(sequelize.json("metadata.transactionRef"), transactionRef) });
    return { withdrawalPayment, transaction };
  }

  const statusResponse = await squadApi.requeryTransfer(transactionRef);
  const squadStatus = statusResponse?.data?.status || "processing";
  const normalized = normalizeStatus(squadStatus);

  const transactionDb = await sequelize.transaction();

  try {
    withdrawalPayment.gatewayResponse = statusResponse;
    withdrawalPayment.status = normalized;
    await withdrawalPayment.save({ transaction: transactionDb });

    const transaction = await Transaction.findOne({ where: sequelize.where(sequelize.json("metadata.transactionRef"), transactionRef), transaction: transactionDb });
    if (transaction) {
      transaction.status = normalized === "successful" ? "completed" : normalized;
      await transaction.save({ transaction: transactionDb });

      if (["failed", "reversed"].includes(normalized) && !withdrawalPayment.refunded) {
        const wallet = await Wallet.findByPk(transaction.senderWallet, { transaction: transactionDb });
        if (wallet) {
          wallet.balance += transaction.amount;
          await wallet.save({ transaction: transactionDb });
          withdrawalPayment.refunded = true;
          await withdrawalPayment.save({ transaction: transactionDb });
        }
      }
    }

    await transactionDb.commit();
    return { withdrawalPayment, transaction };
  } catch (error) {
    await transactionDb.rollback();
    throw error;
  }
};

exports.processWithdrawalWebhook = async (event) => {
  const transactionRef =
    event.data?.transaction_reference ||
    event.data?.transaction_ref ||
    event.data?.reference;

  if (!transactionRef) {
    throw new Error("Invalid webhook payload");
  }

  const status = normalizeStatus(event.data?.status);

  const transactionDb = await sequelize.transaction();

  try {
    const withdrawalPayment = await WithdrawalPayment.findOne({ where: { transactionRef }, transaction: transactionDb });
    if (!withdrawalPayment) {
      throw new Error("Withdrawal not found");
    }
    if (["successful", "failed", "reversed"].includes(withdrawalPayment.status)) {
      await transactionDb.commit();
      return { withdrawalPayment, alreadyProcessed: true };
    }

    withdrawalPayment.status = status;
    withdrawalPayment.gatewayResponse = event.data;
    withdrawalPayment.gatewayResponseCode = event.data?.response_code || "";
    await withdrawalPayment.save({ transaction: transactionDb });

    const transaction = await Transaction.findOne({ where: sequelize.where(sequelize.json("metadata.transactionRef"), transactionRef), transaction: transactionDb });
    if (transaction) {
      transaction.status = status === "successful" ? "completed" : status;
      await transaction.save({ transaction: transactionDb });

      if (["failed", "reversed"].includes(status) && !withdrawalPayment.refunded) {
        const wallet = await Wallet.findByPk(transaction.senderWallet, { transaction: transactionDb });
        if (wallet) {
          wallet.balance += transaction.amount;
          await wallet.save({ transaction: transactionDb });
          withdrawalPayment.refunded = true;
          await withdrawalPayment.save({ transaction: transactionDb });
        }
      }
    }

    await transactionDb.commit();
    return { withdrawalPayment, transaction };
  } catch (error) {
    await transactionDb.rollback();
    throw error;
  }
};
