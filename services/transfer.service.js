const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Transaction = require("../models/Transaction");
const WithdrawalPayment = require("../models/WithdrawalPayment");
const User = require("../models/User");
// const bankService = require("./bankService");
const squadService = require("./squad.service");
const walletService = require("./wallet.service");
const { calculateTransactionFee } = require("../utils/transactionFeeUtils");
const { generateUPRN, validateNameMatch } = require("../utils/paymentUtils");

const SQUAD_MERCHANT_ID = process.env.SQUAD_MERCHANT_ID || "MERCHANT";

const getIdempotencyKey = (key) => String(key || "").trim();

const requireIdempotencyKey = (key) => {
  const idempotencyKey = getIdempotencyKey(key);
  if (!idempotencyKey) {
    const error = new Error("Idempotency-Key header is required");
    error.statusCode = 400;
    throw error;
  }
  return idempotencyKey;
};

const verifyTransactionPin = async (user, transactionPin) => {
  if (!transactionPin) {
    const error = new Error("Transaction PIN is required");
    error.statusCode = 400;
    throw error;
  }

  if (!user.transactionPinHash) {
    const error = new Error(
      "Transaction PIN is not configured for this account",
    );
    error.statusCode = 400;
    throw error;
  }

  const isValidPin = await bcrypt.compare(
    transactionPin,
    user.transactionPinHash,
  );
  if (!isValidPin) {
    const error = new Error("Invalid transaction PIN");
    error.statusCode = 401;
    throw error;
  }
};

const createPayoutReference = () => {
  const merchant = SQUAD_MERCHANT_ID.trim() || "MERCHANT";
  return `${merchant}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
};

const addAudit = (doc, status, message, metadata = {}) => {
  doc.auditTrail = doc.auditTrail || [];
  doc.auditTrail.push({
    status,
    message,
    metadata,
    createdAt: new Date(),
  });
};

const mapTransactionStatus = (status) => {
  if (status === "success" || status === "successful") return "success";
  return status;
};

const mapWithdrawalStatus = (status) => {
  if (status === "success") return "success";
  return status;
};

const accountLookup = async ({ bankCode, accountNumber }) => {
  return squadService.lookupAccount({
    bankCode,
    accountNumber,
  });
};

const internalTransfer = async ({
  user,
  recipientAccount,
  amount,
  description,
  transactionPin,
  idempotencyKey,
}) => {
  const stableKey = requireIdempotencyKey(idempotencyKey);
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  await verifyTransactionPin(user, transactionPin);

  const existing = await Transaction.findOne({
    senderId: user._id,
    idempotencyKey: stableKey,
  });
  if (existing) {
    return { transaction: existing, repeated: true };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const senderWallet = await walletService.getActiveWalletForUser(
      user._id,
      session,
    );
    if (!senderWallet) {
      const error = new Error("Sender wallet not found");
      error.statusCode = 404;
      throw error;
    }

    const recipientWallet = await walletService.getActiveWalletByAccountNumber(
      recipientAccount,
      session,
    );
    if (!recipientWallet) {
      const error = new Error("Recipient account not found");
      error.statusCode = 404;
      throw error;
    }

    if (senderWallet._id.toString() === recipientWallet._id.toString()) {
      const error = new Error("Cannot transfer to yourself");
      error.statusCode = 400;
      throw error;
    }

    if (senderWallet.currency !== recipientWallet.currency) {
      const error = new Error("Currency mismatch");
      error.statusCode = 400;
      throw error;
    }

    const recipientUser = await User.findById(recipientWallet.userId).session(
      session,
    );
    if (!recipientUser) {
      const error = new Error("Recipient user not found");
      error.statusCode = 404;
      throw error;
    }

    const feeDetails = calculateTransactionFee(user, recipientUser, amount);
    const fee = Number(feeDetails.feeAmount || 0);
    const total = amount + fee;

    const debitedWallet = await walletService.debitWallet({
      walletId: senderWallet._id,
      amount: total,
      session,
    });

    await walletService.creditWallet({
      walletId: recipientWallet._id,
      amount,
      session,
    });

    const transaction = new Transaction({
      type: "transfer",
      amount,
      fee,
      total,
      currency: senderWallet.currency,
      status: "success",
      senderWallet: senderWallet._id,
      senderId: user._id,
      recipientWallet: recipientWallet._id,
      recipientId: recipientWallet.userId,
      reference: generateUPRN(user._id, "transfer"),
      idempotencyKey: stableKey,
      isUserAccountTransfer: true,
      description: description || "Wallet transfer",
      paymentMethod: "wallet",
      paymentGateway: feeDetails.paymentGateway || "Internal",
      metadata: {
        recipientAccount,
        feeDetails,
      },
    });
    addAudit(transaction, "success", "Internal transfer completed");

    await transaction.save({ session });
    await session.commitTransaction();

    return {
      transaction,
      senderBalance: debitedWallet.balance,
      repeated: false,
    };
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      const duplicate = await Transaction.findOne({
        idempotencyKey: stableKey,
      });
      if (duplicate) return { transaction: duplicate, repeated: true };
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const finalizePayout = async ({ withdrawal, transaction, payoutResult }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const status = mapWithdrawalStatus(payoutResult.status);
    withdrawal.status = status;
    withdrawal.squadRef = payoutResult.providerReference || withdrawal.squadRef;
    withdrawal.gatewayResponse = payoutResult.raw;
    withdrawal.providerResponses.push(payoutResult.raw);
    addAudit(withdrawal, status, "SquadCo payout response received");

    transaction.status = mapTransactionStatus(payoutResult.status);
    transaction.externalReference = payoutResult.providerReference;
    transaction.providerReference = payoutResult.providerReference;
    transaction.providerResponses.push(payoutResult.raw);
    addAudit(
      transaction,
      transaction.status,
      "Transfer status updated from SquadCo",
    );

    if (["failed", "reversed"].includes(status) && !withdrawal.refunded) {
      await walletService.creditWallet({
        walletId: transaction.senderWallet,
        amount: transaction.total,
        session,
      });
      withdrawal.refunded = true;
      transaction.status = "reversed";
      addAudit(
        transaction,
        "reversed",
        "Wallet debit reversed after failed payout",
      );
      addAudit(
        withdrawal,
        "reversed",
        "Wallet debit reversed after failed payout",
      );
    }

    await withdrawal.save({ session });
    await transaction.save({ session });
    await session.commitTransaction();
    return { withdrawal, transaction };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const markPayoutRetryable = async ({ withdrawal, transaction, error }) => {
  withdrawal.status = "processing";
  withdrawal.errorMessage = error.message;
  withdrawal.errorCode =
    error.code || String(error.statusCode || "SQUAD_ERROR");
  withdrawal.gatewayResponse = error.providerResponse || {};
  addAudit(withdrawal, "processing", "SquadCo payout outcome unknown", {
    retryable: true,
  });

  transaction.status = "processing";
  transaction.failureReason = error.message;
  addAudit(transaction, "processing", "SquadCo payout outcome unknown", {
    retryable: true,
  });

  await withdrawal.save();
  await transaction.save();
  return { withdrawal, transaction };
};

const externalBankTransfer = async ({
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
  flowType = "external_bank_transfer",
}) => {
  const stableKey = requireIdempotencyKey(idempotencyKey);
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  await verifyTransactionPin(user, transactionPin);

  const existing = await WithdrawalPayment.findOne({
    idempotencyKey: stableKey,
  });
  if (existing) {
    const transaction = await Transaction.findOne({
      "metadata.transactionRef": existing.transactionRef,
    });
    return { withdrawal: existing, transaction, repeated: true };
  }

  const lookup = await accountLookup({ bankCode, accountNumber });
  if (accountName && !validateNameMatch(accountName, lookup.accountName)) {
    const error = new Error("Account name mismatch");
    error.statusCode = 400;
    throw error;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let withdrawal;
  let transaction;

  try {
    const wallet = await walletService.getActiveWalletForUser(
      user._id,
      session,
    );
    if (!wallet) {
      const error = new Error("Wallet not found");
      error.statusCode = 404;
      throw error;
    }

    if (wallet.currency !== "NGN") {
      const error = new Error(
        "External bank transfers are only supported in NGN",
      );
      error.statusCode = 400;
      throw error;
    }

    const transactionRef = createPayoutReference();

    withdrawal = new WithdrawalPayment({
      userId: user._id,
      amount,
      currency: "NGN",
      transactionRef,
      idempotencyKey: stableKey,
      flowType,
      bankCode,
      accountNumber,
      accountName: lookup.accountName,
      status: "pending",
      ipAddress,
      userAgent,
      metadata: {
        flowType,
        bankName: lookup.raw?.data?.bank_name || null,
      },
    });
    addAudit(
      withdrawal,
      "pending",
      "External transfer created and awaiting provider",
    );

    transaction = new Transaction({
      senderId: user._id,
      senderWallet: wallet._id,
      amount,
      fee: 0,
      total: amount,
      currency: "NGN",
      type: "withdrawal",
      status: "pending",
      reference: generateUPRN(user._id, "withdrawal"),
      idempotencyKey: stableKey,
      isUserAccountTransfer: true,
      description: description || "External bank transfer",
      paymentMethod: "bank",
      paymentGateway: "SquadCo",
      provider: "SquadCo",
      metadata: {
        transactionRef,
        flowType,
        withdrawalDetails: {
          accountName: lookup.accountName,
          accountNumber,
          bankCode,
          bankName: lookup.raw?.data?.bank_name || null,
        },
      },
    });
    addAudit(
      transaction,
      "pending",
      "Wallet debit reserved for external transfer",
    );

    await withdrawal.save({ session });
    await transaction.save({ session });
    await walletService.debitWallet({ walletId: wallet._id, amount, session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      const duplicate = await WithdrawalPayment.findOne({
        idempotencyKey: stableKey,
      });
      if (duplicate) {
        const duplicateTransaction = await Transaction.findOne({
          "metadata.transactionRef": duplicate.transactionRef,
        });
        return {
          withdrawal: duplicate,
          transaction: duplicateTransaction,
          repeated: true,
        };
      }
    }
    throw error;
  } finally {
    session.endSession();
  }

  try {
    const payoutResult = await squadService.initiatePayout({
      amount,
      bankCode,
      accountNumber,
      accountName: lookup.accountName,
      transactionRef: withdrawal.transactionRef,
      description: description || "Wallet withdrawal",
    });

    const finalized = await finalizePayout({
      withdrawal,
      transaction,
      payoutResult,
    });
    return { ...finalized, repeated: false };
  } catch (error) {
    if (error.retryable) {
      const pending = await markPayoutRetryable({
        withdrawal,
        transaction,
        error,
      });
      return { ...pending, repeated: false, retryRequired: true };
    }

    const failed = await finalizePayout({
      withdrawal,
      transaction,
      payoutResult: {
        status: "failed",
        raw: error.providerResponse || { message: error.message },
        providerReference: null,
      },
    });
    return { ...failed, repeated: false };
  }
};

const verifyExternalTransferStatus = async (transactionRef) => {
  const withdrawal = await WithdrawalPayment.findOne({ transactionRef });
  if (!withdrawal) {
    const error = new Error("Transfer not found");
    error.statusCode = 404;
    throw error;
  }

  const transaction = await Transaction.findOne({
    "metadata.transactionRef": transactionRef,
  });

  if (
    ["success", "successful", "failed", "reversed"].includes(withdrawal.status)
  ) {
    return { withdrawal, transaction };
  }

  const payoutResult = await squadService.requeryPayout(transactionRef);
  return finalizePayout({ withdrawal, transaction, payoutResult });
};

module.exports = {
  accountLookup,
  externalBankTransfer,
  internalTransfer,
  verifyExternalTransferStatus,
};
