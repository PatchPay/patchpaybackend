const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const sequelize = require("../config/database");
const { generateUPRN } = require("../utils/paymentUtils");


const { Op } = require("sequelize");
// Get all transactions
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user transactions


const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;

    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get transaction by ID
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create transaction
const createTransaction = async (req, res) => {
  const dbTransaction = await sequelize.transaction();

  try {
    const {
      amount,
      senderWalletId,
      recipientWalletId,
      description,
    } = req.body;

    const senderWallet = await Wallet.findByPk(senderWalletId, {
      transaction: dbTransaction,
      lock: true,
    });

    const recipientWallet = await Wallet.findByPk(recipientWalletId, {
      transaction: dbTransaction,
      lock: true,
    });

    if (!senderWallet || !recipientWallet) {
      await dbTransaction.rollback();

      return res.status(404).json({
        success: false,
        message: !senderWallet
          ? "Sender wallet not found"
          : "Recipient wallet not found",
      });
    }

    if (Number(senderWallet.balance) < Number(amount)) {
      await dbTransaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    const reference = await generateUPRN(senderWallet.userId, "transfer");

    const transaction = await Transaction.create(
      {
        type: "transfer",
        amount,
        currency: senderWallet.currency,
        senderWallet: senderWallet.id,
        senderId: senderWallet.userId,
        recipientWallet: recipientWallet.id,
        recipientId: recipientWallet.userId,
        reference,
        description,
        status: "completed",
      },
      {
        transaction: dbTransaction,
      }
    );

    senderWallet.balance =
      Number(senderWallet.balance) - Number(amount);

    recipientWallet.balance =
      Number(recipientWallet.balance) + Number(amount);

    await senderWallet.save({
      transaction: dbTransaction,
    });

    await recipientWallet.save({
      transaction: dbTransaction,
    });

    await dbTransaction.commit();

    return res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    await dbTransaction.rollback();

    console.error("Error creating transaction:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: error.message,
    });
  }
};

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  getUserTransactions,
};