const crypto = require("crypto");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");

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

const getUserDisplayName = (user) => {
  if (!user) return "";
  if (user.accountType === "Personal") {
    return `${user.firstName || ""} ${user.middleName || ""} ${user.surname || ""}`
      .replace(/\s+/g, " ")
      .trim();
  }
  return (
    user.businessName ||
    user.organizationName ||
    user.departmentName ||
    user.email ||
    ""
  );
};

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

// Sequelize JSON/JSONB fields don't auto-detect in-place array mutation
// (e.g. `.push(...)`), so audit/provider-response entries are appended by
// reassigning the array rather than mutating it, which keeps `.save()`
// picking up the change.
const addAudit = (doc, status, message, metadata = {}) => {
  const entry = {
    status,
    message,
    metadata,
    createdAt: new Date(),
  };
  doc.auditTrail = [...(doc.auditTrail || []), entry];
};

const appendProviderResponse = (doc, response) => {
  doc.providerResponses = [...(doc.providerResponses || []), response];
};

const mapTransactionStatus = (status) => {
  if (status === "success" || status === "successful") {
    return "completed";
  }

  return status;
};

const mapWithdrawalStatus = (status) => {
  if (status === "success") return "success";
  return status;
};

// Sequelize's unique-constraint violation, in place of Mongo's `error.code === 11000`
const isUniqueConstraintError = (error) =>
  error?.name === "SequelizeUniqueConstraintError";

const accountLookup = async ({ bankCode, accountNumber }) => {
  if (!bankCode) {
    const wallet =
      await walletService.getActiveWalletByAccountNumber(accountNumber);
    if (!wallet) {
      const error = new Error("Recipient account not found");
      error.statusCode = 404;
      throw error;
    }

    const user = await User.findByPk(wallet.userId);
    if (!user) {
      const error = new Error("Recipient user not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      accountName: getUserDisplayName(user),
      accountNumber: wallet.accountNumber,
      bankCode: null,
      currency: wallet.currency,
      accountType: user.accountType,
      internal: true,
      verified: true,
    };
  }

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
    where: {
      senderId: user.id,
      idempotencyKey: stableKey,
    },
  });
  if (existing) {
    const senderWallet = await walletService.getActiveWalletForUser(user.id);
    return {
      transaction: existing,
      senderBalance: senderWallet?.balance,
      repeated: true,
    };
  }

  const t = await sequelize.transaction();

  try {
    const senderWallet = await walletService.getActiveWalletForUser(
      user.id,
      t,
    );
    if (!senderWallet) {
      const error = new Error("Sender wallet not found");
      error.statusCode = 404;
      throw error;
    }

    const recipientWallet = await walletService.getActiveWalletByAccountNumber(
      recipientAccount,
      t,
    );
    if (!recipientWallet) {
      const error = new Error("Recipient account not found");
      error.statusCode = 404;
      throw error;
    }

    if (senderWallet.id === recipientWallet.id) {
      const error = new Error("Cannot transfer to yourself");
      error.statusCode = 400;
      throw error;
    }

    if (senderWallet.currency !== recipientWallet.currency) {
      const error = new Error("Currency mismatch");
      error.statusCode = 400;
      throw error;
    }

    const recipientUser = await User.findByPk(recipientWallet.userId, {
      transaction: t,
    });
    if (!recipientUser) {
      const error = new Error("Recipient user not found");
      error.statusCode = 404;
      throw error;
    }

    const feeDetails = calculateTransactionFee(user, recipientUser, amount);
    const fee = Number(feeDetails.feeAmount || 0);
    const total = amount + fee;

    const debitedWallet = await walletService.debitWallet({
      walletId: senderWallet.id,
      amount: total,
      transaction: t,
    });

    await walletService.creditWallet({
      walletId: recipientWallet.id,
      amount,
      transaction: t,
    });

    const sharedReference = generateUPRN(user.id, "transfer");
    const senderName = getUserDisplayName(user);
    const recipientName = getUserDisplayName(recipientUser);

    const senderTransaction = await Transaction.create(
      {
        type: "transfer",
        amount,
        fee,
        total,
        currency: senderWallet.currency,
        status: "completed",
        senderWallet: senderWallet.id,
        senderId: user.id,
        reference: `${sharedReference}-DR`,
        idempotencyKey: stableKey,
        isUserAccountTransfer: true,
        description: description || "Wallet transfer",
        paymentMethod: "wallet",
        paymentGateway: feeDetails.paymentGateway || "Internal",
        metadata: {
          sharedReference,
          transferRole: "debit",
          recipientAccount,
          recipientId: recipientWallet.userId,
          recipientWallet: recipientWallet.id,
          recipientName,
          senderName,
          feeDetails,
        },
      },
      { transaction: t },
    );
    addAudit(senderTransaction, "success", "Internal transfer completed");

    const receiverTransaction = await Transaction.create(
      {
        type: "transfer",
        amount,
        fee: 0,
        total: amount,
        currency: recipientWallet.currency,
        status: "completed",
        recipientWallet: recipientWallet.id,
        recipientId: recipientWallet.userId,
        reference: `${sharedReference}-CR`,
        idempotencyKey: `${stableKey}:credit`,
        isUserAccountTransfer: true,
        description: description || "Wallet transfer received",
        paymentMethod: "wallet",
        paymentGateway: feeDetails.paymentGateway || "Internal",
        metadata: {
          sharedReference,
          transferRole: "credit",
          senderId: user.id,
          senderWallet: senderWallet.id,
          senderAccount: senderWallet.accountNumber,
          senderName,
          recipientName,
        },
      },
      { transaction: t },
    );
    addAudit(
      receiverTransaction,
      "success",
      "Internal transfer credit completed",
    );

    // addAudit mutated auditTrail after create(), so persist that change
    await senderTransaction.save({ transaction: t });
    await receiverTransaction.save({ transaction: t });

    await t.commit();

    return {
      transaction: senderTransaction,
      receiverTransaction,
      senderBalance: debitedWallet.balance,
      repeated: false,
    };
  } catch (error) {
    await t.rollback();
    if (isUniqueConstraintError(error)) {
      const duplicate = await Transaction.findOne({
        where: {
          idempotencyKey: stableKey,
        },
      });
      if (duplicate) return { transaction: duplicate, repeated: true };
    }
    throw error;
  }
};

const finalizePayout = async ({ withdrawal, transaction: transactionRecord, payoutResult }) => {
  const t = await sequelize.transaction();

  try {
    withdrawal = await WithdrawalPayment.findByPk(withdrawal.id, {
      transaction: t,
    });

    if (!withdrawal) {
      throw new Error("Withdrawal record not found");
    }

    if (transactionRecord) {
      transactionRecord = await Transaction.findByPk(transactionRecord.id, {
        transaction: t,
      });

      if (!transactionRecord) {
        throw new Error("Transaction record not found");
      }
    }

    // Ensure arrays exist
    withdrawal.providerResponses ??= [];
    withdrawal.auditTrail ??= [];

    if (transactionRecord) {
      transactionRecord.providerResponses ??= [];
      transactionRecord.auditTrail ??= [];
    }

    const status = mapWithdrawalStatus(payoutResult.status);

    withdrawal.status = status;
    withdrawal.squadRef =
      payoutResult.providerReference || withdrawal.squadRef;
    withdrawal.gatewayResponse = payoutResult.raw;
    appendProviderResponse(withdrawal, payoutResult.raw);

    addAudit(withdrawal, status, "SquadCo payout response received");

    if (transactionRecord) {
      transactionRecord.status = mapTransactionStatus(payoutResult.status);
      transactionRecord.externalReference = payoutResult.providerReference;
      transactionRecord.providerReference = payoutResult.providerReference;

      appendProviderResponse(transactionRecord, payoutResult.raw);

      addAudit(
        transactionRecord,
        transactionRecord.status,
        "Transfer status updated from SquadCo",
      );
    }

    if (
      transactionRecord &&
      ["failed", "reversed"].includes(status) &&
      !withdrawal.refunded
    ) {
      await walletService.creditWallet({
        walletId: transactionRecord.senderWallet,
        amount: transactionRecord.total,
        transaction: t,
      });

      withdrawal.refunded = true;
      transactionRecord.status = "reversed";

      addAudit(
        transactionRecord,
        "reversed",
        "Wallet debit reversed after failed payout",
      );

      addAudit(
        withdrawal,
        "reversed",
        "Wallet debit reversed after failed payout",
      );
    }

    await withdrawal.save({ transaction: t });

    if (transactionRecord) {
      await transactionRecord.save({ transaction: t });
    }

    await t.commit();

    return {
      withdrawal,
      transaction: transactionRecord,
    };
  } catch (error) {
    await t.rollback();
    throw error;
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
    where: {
      idempotencyKey: stableKey,
    },
  });
  if (existing) {
    const existingTransaction = await Transaction.findOne({
      where: {
        "metadata.transactionRef": existing.transactionRef,
      },
    });
    return { withdrawal: existing, transaction: existingTransaction, repeated: true };
  }

  const lookup = await accountLookup({ bankCode, accountNumber });
  if (accountName && !validateNameMatch(accountName, lookup.accountName)) {
    const error = new Error("Account name mismatch");
    error.statusCode = 400;
    throw error;
  }

  const t = await sequelize.transaction();

  let withdrawal;
  let transactionRecord;

  try {
    const wallet = await walletService.getActiveWalletForUser(user.id, t);
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

    withdrawal = WithdrawalPayment.build({
      userId: user.id,
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

    transactionRecord = await Transaction.create(
      {
        senderId: user.id,
        senderWallet: wallet.id,
        amount,
        fee: 0,
        total: amount,
        currency: "NGN",
        type: "withdrawal",
        status: "pending",
        reference: generateUPRN(user.id, "withdrawal"),
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
      },
      { transaction: t },
    );
    addAudit(
      transactionRecord,
      "pending",
      "Wallet debit reserved for external transfer",
    );

    await withdrawal.save({ transaction: t });
    await transactionRecord.save({ transaction: t });
    await walletService.debitWallet({
      walletId: wallet.id,
      amount,
      transaction: t,
    });

    await t.commit();
  } catch (error) {
    await t.rollback();
    if (isUniqueConstraintError(error)) {
      const duplicate = await WithdrawalPayment.findOne({
        where: { idempotencyKey: stableKey },
      });
      if (duplicate) {
        const duplicateTransaction = await Transaction.findOne({
          where: {
            "metadata.transactionRef": duplicate.transactionRef,
          },
        });
        return {
          withdrawal: duplicate,
          transaction: duplicateTransaction,
          repeated: true,
        };
      }
    }
    throw error;
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
      transaction: transactionRecord,
      payoutResult,
    });
    return { ...finalized, repeated: false };
  } catch (error) {
    if (error.retryable) {
      await markPayoutRetryable({
        withdrawal,
        transaction: transactionRecord,
        error,
      });

      const err = new Error(
        "Transfer is still processing. Please check your transaction history shortly.",
      );
      err.statusCode = 202;
      throw err;
    }

    await finalizePayout({
      withdrawal,
      transaction: transactionRecord,
      payoutResult: {
        status: "failed",
        raw: error.providerResponse || { message: error.message },
        providerReference: null,
      },
    });

    // Throw a clean error to the frontend
    const err = new Error(
      error.response?.data?.message ||
        error.providerResponse?.message ||
        error.message ||
        "External bank transfer failed.",
    );

    err.statusCode = error.statusCode || 400;

    throw err;
  }
};

const verifyExternalTransferStatus = async (transactionRef) => {
  const withdrawal = await WithdrawalPayment.findOne({
    where: { transactionRef },
  });
  if (!withdrawal) {
    const error = new Error("Transfer not found");
    error.statusCode = 404;
    throw error;
  }

  const transaction = await Transaction.findOne({
    where: {
      "metadata.transactionRef": transactionRef,
    },
  });

  if (
    ["success", "successful", "failed", "reversed"].includes(withdrawal.status)
  ) {
    return { withdrawal, transaction };
  }

  const payoutResult = await squadService.requeryPayout(transactionRef);
  return finalizePayout({ withdrawal, transaction, payoutResult });
};

const processExternalTransferWebhook = async (event) => {
  const data = event.Body || event.body || event.data || event;
  const transactionRef =
    data.transaction_reference ||
    data.transaction_ref ||
    data.reference ||
    event.TransactionRef;

  if (!transactionRef) {
    const error = new Error("Invalid webhook payload");
    error.statusCode = 400;
    throw error;
  }

  const withdrawal = await WithdrawalPayment.findOne({
    where: { transactionRef },
  });
  if (!withdrawal) {
    const error = new Error("Transfer not found");
    error.statusCode = 404;
    throw error;
  }

  const transaction = await Transaction.findOne({
    where: {
      "metadata.transactionRef": transactionRef,
    },
  });

  if (
    ["success", "successful", "failed", "reversed"].includes(withdrawal.status)
  ) {
    return { withdrawal, transaction, alreadyProcessed: true };
  }

  const payoutResult = {
    status: squadService.normalizePayoutStatus(data.status || event.status),
    providerReference:
      data.nip_transaction_reference ||
      data.transaction_reference ||
      data.reference ||
      null,
    raw: event,
  };

  const result = await finalizePayout({
    withdrawal,
    transaction,
    payoutResult,
  });
  return { ...result, alreadyProcessed: false };
};

module.exports = {
  accountLookup,
  externalBankTransfer,
  internalTransfer,
  processExternalTransferWebhook,
  verifyExternalTransferStatus,
};