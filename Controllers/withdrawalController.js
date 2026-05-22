const WithdrawalPayment = require("../models/WithdrawalPayment");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const mongoose = require("mongoose");
const bankService = require("../services/bankService");
const squadApi = require("../utils/squadApiUtils");
const transferService = require("../services/transfer.service");

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
  try {
    const user = req.user;
    const idempotencyKey =
      req.headers["x-idempotency-key"] || req.body.idempotencyKey;
    const transactionPin = req.body.transactionPin;
    const payload = {
      user,
      amount: req.body.amount,
      bankCode: req.body.bankCode || req.body.bank_code,
      accountNumber: req.body.accountNumber || req.body.account_number,
      accountName: req.body.accountName,
      description: req.body.description,
      transactionPin,
      idempotencyKey,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      flowType: req.body.flowType || "withdrawal",
    };

    const result = await transferService.externalBankTransfer(payload);
    const withdrawal = result.withdrawal;
    const transaction = result.transaction;

    return res.status(200).json({
      success: true,
      data: {
        withdrawal: {
          id: withdrawal._id,
          transactionRef: withdrawal.transactionRef,
          squadRef: withdrawal.squadRef,
          amount: withdrawal.amount,
          currency: withdrawal.currency,
          status: withdrawal.status,
        },
        transaction: transaction
          ? {
              id: transaction._id,
              reference: transaction.reference,
              amount: transaction.amount,
              currency: transaction.currency,
              status: transaction.status,
            }
          : null,
      },
      repeated: result.repeated || false,
    });
  } catch (error) {
    console.error("Withdrawal initiation error:", error.message || error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to initiate withdrawal",
    });
  }
};

exports.initiateExternalTransfer = async (req, res) => {
  req.body.flowType = "external_bank_transfer";
  return exports.initiateWithdrawal(req, res);
};

exports.verifyWithdrawal = async (req, res) => {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const result =
      await transferService.verifyExternalTransferStatus(transactionRef);
    return res.status(200).json({
      success: true,
      message: `Withdrawal status: ${result.withdrawal.status}`,
      data: {
        withdrawal: result.withdrawal,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    console.error("Verify withdrawal error:", error.message || error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify withdrawal",
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
    const result = await transferService.processExternalTransferWebhook(event);

    if (result.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "Withdrawal already processed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Webhook processing error:", error.message || error);
    return res.status(500).json({
      success: false,
      message: error.message || "Webhook processing error",
    });
  }
};

/**
 * Get bank list for withdrawals
 * @route GET /api/payments/withdrawal/banks
 */
exports.getBanks = async (req, res) => {
  try {
    const banks = await bankService.getBanks({
      forceRefresh: req.query.force === "true",
    });
    const formatted = banks.map((bank) => ({
      code: bank.bank_code,
      name: bank.name,
      active: bank.active,
    }));

    return res.status(200).json({
      success: true,
      data: { banks: formatted },
    });
  } catch (error) {
    console.error("Error getting banks list:", error.message || error);
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
    const accountNumber = req.body.accountNumber || req.body.account_number;

    const bankCode = req.body.bankCode || req.body.bank_code;

    console.log("DEBUG ACCOUNT:", accountNumber);
    console.log("DEBUG BANK:", bankCode);

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: "accountNumber and bankCode are required",
      });
    }

    const squadRes = await squadApi.lookupAccount({
      accountNumber,
      bankCode,
    });

    return res.status(200).json({
      success: true,
      data: {
        accountName: squadRes.data?.account_name,
        accountNumber: squadRes.data?.account_number,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Resolve account error:", error.response?.data || error);

    return res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Failed to resolve bank account",
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
      account_number: withdrawal.account_number,
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
