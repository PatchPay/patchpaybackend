const WithdrawalPayment = require("../models/WithdrawalPayment");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const mongoose = require("mongoose");
const { generateUPRN } = require("../utils/paymentUtils");
const squadApi = require("../utils/squadApiUtils");

/**
 * Initiate a withdrawal request
 * @route POST /api/payments/withdrawal/initiate
 */
// controllers/withdrawalController.js

/**
 * INITIATE WITHDRAWAL
 * @route POST /api/payments/withdrawal/initiate
 */
exports.initiateWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    /**
     * USER
     */
    const user = req.user;

    /**
     * REQUEST BODY
     */
    const { amount, bankCode, accountNumber, accountName, description } =
      req.body;

    /**
     * VALIDATIONS
     */
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount",
      });
    }

    if (!bankCode || !accountNumber || !accountName) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Bank details are required",
      });
    }

    /**
     * VERIFY ACCOUNT USING SQUAD
     */
    const accountLookup = await squadApi.lookupAccount({
      bankCode,
      accountNumber,
    });

    if (!accountLookup || !accountLookup.success || !accountLookup.data) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Unable to verify bank account",
      });
    }

    /**
     * ACCOUNT NAME MATCH CHECK
     */
    const resolvedAccountName = accountLookup.data.account_name;

    if (
      resolvedAccountName.toLowerCase().trim() !==
      accountName.toLowerCase().trim()
    ) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Account name mismatch",
        data: {
          squadAccountName: resolvedAccountName,
        },
      });
    }

    /**
     * FIND WALLET
     */
    const wallet = await Wallet.findOne({
      userId: user._id,
    }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    /**
     * ONLY NGN
     */
    if (wallet.currency !== "NGN") {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Withdrawals are only supported in NGN",
      });
    }

    /**
     * CHECK BALANCE
     */
    if (Number(wallet.balance) < Number(amount)) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    /**
     * GENERATE REFERENCES
     */
    const withdrawalUprn = generateUPRN(user._id, "withdrawal");

    const merchantId = process.env.SQUAD_MERCHANT_ID.trim();

    const transactionRef = `${merchantId}_${Date.now()}`;

    /**
     * CREATE WITHDRAWAL RECORD
     */
    const withdrawalPayment = new WithdrawalPayment({
      userId: user._id,

      amount,

      currency: "NGN",

      transactionRef,

      bankCode,

      accountNumber,

      accountName,

      status: "pending",
    });

    await withdrawalPayment.save({
      session,
    });

    /**
     * CREATE TRANSACTION RECORD
     */
    const transaction = new Transaction({
      senderId: user._id,

      senderWallet: wallet._id,

      total: amount,

      amount,

      currency: "NGN",

      type: "withdrawal",

      status: "pending",

      reference: withdrawalUprn,

      isUserAccountTransfer: true,

      description: description || "Withdrawal from wallet",

      paymentMethod: "bank",

      metadata: {
        withdrawalDetails: {
          accountName,

          accountNumber,

          bankCode,
        },

        transactionRef,
      },
    });

    await transaction.save({
      session,
    });

    /**
     * DEDUCT USER BALANCE
     */
    wallet.balance -= Number(amount);

    await wallet.save({
      session,
    });

    /**
     * INITIATE WITHDRAWAL
     */
    try {
      const withdrawalPayload = {
        amount,
        bankCode,
        accountNumber,
        accountName,
        transactionRef,
        description,
      };

      console.log("🔥 CONTROLLER PAYLOAD:", withdrawalPayload);

      const squadResponse =
        await squadApi.initiateWithdrawal(withdrawalPayload);

      /**
       * STORE GATEWAY RESPONSE
       */
      withdrawalPayment.gatewayResponse = squadResponse;

      /**
       * VERY IMPORTANT
       * DO NOT TRUST ONLY STATUS CODE
       */
      const nipReference = squadResponse?.data?.nip_transaction_reference;

      /**
       * HANDLE PENDING REQUERY
       */
      if (!nipReference) {
        withdrawalPayment.status = "pending_requery";

        transaction.status = "pending";
      } else {
        withdrawalPayment.status = "processing";

        transaction.status = "processing";
      }

      /**
       * SAVE NIP REFERENCE
       */
      withdrawalPayment.squadRef = nipReference || null;

      transaction.externalReference = nipReference || null;

      await withdrawalPayment.save({
        session,
      });

      await transaction.save({
        session,
      });

      /**
       * COMMIT TRANSACTION
       */
      await session.commitTransaction();

      session.endSession();

      return res.status(200).json({
        success: true,

        message: !nipReference
          ? "Withdrawal initiated and pending confirmation"
          : "Withdrawal initiated successfully",

        data: {
          withdrawal: {
            id: withdrawalPayment._id,

            transactionRef,

            squadRef: nipReference,

            amount,

            currency: "NGN",

            status: withdrawalPayment.status,
          },

          transaction: {
            id: transaction._id,

            reference: withdrawalUprn,

            amount,

            currency: "NGN",

            status: transaction.status,
          },
        },
      });
    } catch (error) {
      console.error(
        "Squad transfer failed:",
        error.response?.data || error.message,
      );

      /**
       * REFUND USER
       */
      wallet.balance += Number(amount);

      await wallet.save({
        session,
      });

      /**
       * UPDATE WITHDRAWAL STATUS
       */
      withdrawalPayment.status = "failed";

      withdrawalPayment.errorMessage =
        error.response?.data?.message || error.message;

      withdrawalPayment.errorCode = error.response?.status || "NETWORK_ERROR";

      /**
       * UPDATE TRANSACTION STATUS
       */
      transaction.status = "failed";

      await withdrawalPayment.save({
        session,
      });

      await transaction.save({
        session,
      });

      /**
       * COMMIT FAILURE STATE
       */
      await session.commitTransaction();

      session.endSession();

      return res.status(500).json({
        success: false,

        message: "Failed to process withdrawal",

        error: error.response?.data?.message || error.message,
      });
    }
  } catch (error) {
    console.error("Withdrawal controller error:", error);

    await session.abortTransaction();

    session.endSession();

    return res.status(500).json({
      success: false,

      message: "Failed to initiate withdrawal",

      error: error.message,
    });
  }
};

/**
 * VERIFY / REQUERY WITHDRAWAL
 * @route POST /api/payments/withdrawal/verify
 */
exports.verifyWithdrawal = async (req, res) => {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    /**
     * FIND WITHDRAWAL
     */
    const withdrawalPayment = await WithdrawalPayment.findOne({
      transactionRef,
    });

    if (!withdrawalPayment) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    /**
     * IF ALREADY COMPLETED
     */
    if (
      ["successful", "failed", "reversed"].includes(withdrawalPayment.status)
    ) {
      return res.status(200).json({
        success: true,

        message: `Withdrawal status: ${withdrawalPayment.status}`,

        data: withdrawalPayment,
      });
    }

    /**
     * REQUERY SQUAD
     */
    const statusResponse = await squadApi.requeryTransfer(transactionRef);

    console.log("Squad requery response:", statusResponse);

    withdrawalPayment.gatewayResponse = statusResponse;

    let newStatus = "processing";

    const squadStatus = statusResponse?.data?.status?.toLowerCase() || "";

    /**
     * MAP STATUS
     */
    if (["successful", "success", "completed"].includes(squadStatus)) {
      newStatus = "successful";
    } else if (
      ["failed", "failure", "declined", "rejected", "reversed"].includes(
        squadStatus,
      )
    ) {
      newStatus = squadStatus;
    }

    /**
     * UPDATE WITHDRAWAL
     */
    withdrawalPayment.status = newStatus;

    await withdrawalPayment.save();

    /**
     * UPDATE TRANSACTION
     */
    const transaction = await Transaction.findOne({
      "metadata.transactionRef": transactionRef,
    });

    if (transaction) {
      transaction.status = newStatus === "successful" ? "completed" : newStatus;

      await transaction.save();

      /**
       * REFUND USER IF FAILED
       */
      if (["failed", "reversed"].includes(newStatus)) {
        const wallet = await Wallet.findById(transaction.senderWallet);

        if (wallet && !withdrawalPayment.refunded) {
          wallet.balance += transaction.amount;

          await wallet.save();

          withdrawalPayment.refunded = true;

          await withdrawalPayment.save();
        }
      }
    }

    return res.status(200).json({
      success: true,

      message: `Withdrawal status: ${newStatus}`,

      data: {
        withdrawal: withdrawalPayment,

        transaction,
      },
    });
  } catch (error) {
    console.error("Verify withdrawal error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to verify withdrawal",

      error: error.response?.data?.message || error.message,
    });
  }
};

/**
 * Process Squad webhook for withdrawal status updates
 * @route POST /api/payments/withdrawal/webhook
 */
exports.webhookHandler = async (req, res) => {
  try {
    const event = req.body;

    console.log("Received Squad webhook:", event);

    /**
     * GET TRANSACTION REFERENCE
     */
    const transactionRef =
      event.data?.transaction_reference ||
      event.data?.transaction_ref ||
      event.data?.reference;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload",
      });
    }

    /**
     * FIND WITHDRAWAL
     */
    const withdrawalPayment = await WithdrawalPayment.findOne({
      transactionRef,
    });

    if (!withdrawalPayment) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    /**
     * PREVENT DOUBLE PROCESSING
     */
    if (
      ["successful", "failed", "reversed"].includes(withdrawalPayment.status)
    ) {
      return res.status(200).json({
        success: true,
        message: "Withdrawal already processed",
      });
    }

    /**
     * GET STATUS
     */
    const status = event.data?.status?.toLowerCase() || "processing";

    let newStatus = "processing";

    /**
     * MAP STATUS
     */
    if (["successful", "success", "completed"].includes(status)) {
      newStatus = "successful";
    } else if (
      ["failed", "failure", "declined", "rejected", "reversed"].includes(status)
    ) {
      newStatus = status;
    }

    /**
     * UPDATE WITHDRAWAL
     */
    withdrawalPayment.status = newStatus;

    withdrawalPayment.gatewayResponse = event.data;

    withdrawalPayment.gatewayResponseCode = event.data?.response_code || "";

    await withdrawalPayment.save();

    /**
     * FIND TRANSACTION
     */
    const transaction = await Transaction.findOne({
      "metadata.transactionRef": withdrawalPayment.transactionRef,
    });

    if (transaction) {
      transaction.status = newStatus === "successful" ? "completed" : newStatus;

      await transaction.save();

      /**
       * REFUND USER
       */
      if (["failed", "reversed"].includes(newStatus)) {
        const wallet = await Wallet.findById(transaction.senderWallet);

        /**
         * PREVENT DOUBLE REFUND
         */
        if (wallet && !withdrawalPayment.refunded) {
          wallet.balance += transaction.amount;

          await wallet.save();

          withdrawalPayment.refunded = true;

          await withdrawalPayment.save();
        }
      }
    }

    console.log(
      `Withdrawal ${newStatus}: ${withdrawalPayment.amount} ${withdrawalPayment.currency}`,
    );

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing error",
      error: error.message,
    });
  }
};

/**
 * Get bank list for withdrawals
 * @route GET /api/payments/withdrawal/banks
 */
exports.getBanks = async (req, res) => {
  try {
    const banksResponse = await squadApi.getBanks();

    if (!banksResponse || banksResponse.status !== 200) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve banks list",
      });
    }

    // Format banks data
    const banks =
      banksResponse.data?.map((bank) => ({
        code: bank.code,
        name: bank.name,
      })) || [];

    return res.status(200).json({
      success: true,
      data: { banks },
    });
  } catch (error) {
    console.error("Error getting banks list:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get banks list",
      error: error.message,
    });
  }
};

/**
 * Resolve bank account
 * @route POST /api/payments/withdrawal/resolve-account
 */
exports.resolveAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: "Account number and bank code are required",
      });
    }

    /**
     * USE SQUAD LOOKUP
     */
    const accountResponse = await squadApi.lookupAccount({
      accountNumber,
      bankCode,
    });

    if (!accountResponse || !accountResponse.success) {
      return res.status(400).json({
        success: false,
        message: "Could not resolve bank account",
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        accountName: accountResponse.data?.account_name,

        accountNumber,

        bankCode,
      },
    });
  } catch (error) {
    console.error("Error resolving bank account:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to resolve bank account",

      error: error.response?.data?.message || error.message,
    });
  }
};

/**
 * Get user's withdrawal history
 * @route GET /api/payments/withdrawal/history
 */
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Count total documents for pagination
    const total = await WithdrawalPayment.countDocuments({ userId });

    // Get withdrawals with pagination
    const withdrawals = await WithdrawalPayment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Format withdrawals for response
    const formattedWithdrawals = withdrawals.map((withdrawal) => ({
      id: withdrawal._id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      accountNumber: withdrawal.accountNumber,
      accountName: withdrawal.accountName,
      status: withdrawal.status,
      transactionRef: withdrawal.transactionRef,
      createdAt: withdrawal.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        withdrawals: formattedWithdrawals,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting withdrawal history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get withdrawal history",
      error: error.message,
    });
  }
};
