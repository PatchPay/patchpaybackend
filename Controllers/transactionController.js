const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const mongoose = require("mongoose");
const { generateUPRN } = require("../utils/paymentUtils");

// Get all transactions
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("senderWallet")
      .populate("recipientWallet");
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getUserTransactions = async (req, res) => {
  try {
    const userId = req.params.userId;

    const transactions = await Transaction.find({
      $or: [{ senderId: userId }, { recipientId: userId }],
    })
      .populate("senderWallet")
      .populate("recipientWallet")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user transactions",
    });
  }
};

// Get a single transaction by ID
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("senderWallet")
      .populate("recipientWallet");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
    });
  }
};

// Create a new transaction
const createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, senderWalletId, recipientWalletId, description } = req.body;

    // Get the wallets
    const senderWallet = await Wallet.findById(senderWalletId).session(session);
    const recipientWallet =
      await Wallet.findById(recipientWalletId).session(session);

    if (!senderWallet || !recipientWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: !senderWallet
          ? "Sender wallet not found"
          : "Recipient wallet not found",
      });
    }

    // Check if sender has sufficient balance
    if (senderWallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Generate UPRN
    const reference = await generateUPRN(senderWallet.userId, "transfer");

    // Create the transaction
    const transaction = new Transaction({
      type: "transfer",
      amount,
      currency: senderWallet.currency,
      senderWallet: senderWalletId,
      senderId: senderWallet.userId,
      recipientWallet: recipientWalletId,
      recipientId: recipientWallet.userId,
      reference,
      description,
      status: "completed",
    });

    await transaction.save({ session });

    // Update wallet balances
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;

    await senderWallet.save({ session });
    await recipientWallet.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error creating transaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
    });
  }
};
module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  getUserTransactions,
};
