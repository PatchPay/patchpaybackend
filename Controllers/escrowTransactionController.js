const EscrowTransaction = require('../models/EscrowTransaction');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const sequelize = require('../config/database');

// Create a new escrow transaction
exports.createTransaction = async (req, res) => {
  const transactionDb = await sequelize.transaction();

  try {
    const { amount, type, metadata } = req.body;
    const escrowId = req.params.id;
    const userId = req.user.id; // From auth middleware

    // Get the escrow details
    const escrow = await Escrow.findByPk(escrowId, { transaction: transactionDb });
    if (!escrow) {
      await transactionDb.rollback();
      return res.status(404).json({ success: false, message: 'Escrow not found' });
    }

    // Get user's wallet
    const userWallet = await Wallet.findOne({ where: {
      userId,
      currency: escrow.currency,
      isActive: true
    }, transaction: transactionDb });

    if (!userWallet) {
      await transactionDb.rollback();
      return res.status(404).json({ success: false, message: 'User wallet not found' });
    }

    // Check if user has sufficient balance
    if (userWallet.balance < amount) {
      await transactionDb.rollback();
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Calculate balances
    const currentBalance = escrow.currentBalance || 0;
    const newBalance = type === 'FUND' ? currentBalance + amount : currentBalance - amount;
    const outstandingBalance = escrow.amount - newBalance;

    // Generate transaction reference
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const transactionReference = `ESC-TXN-${timestamp}-${random}`;

    // Create wallet transaction
    const walletTransaction = await Transaction.create({
      type: 'transfer',
      amount: amount,
      fee: 0,
      total: amount,
      currency: escrow.currency,
      status: 'completed',
      senderWallet: userWallet.id,
      senderId: userId,
      recipientId: escrow.recipientId,
      reference: transactionReference,
      description: `Escrow funding: ${escrow.escrowUprn}`,
      isUserAccountTransfer: true,
      metadata: {
        escrowId: escrow.id,
        escrowUprn: escrow.escrowUprn,
        transactionType: 'ESCROW_FUND'
      }
    }, { transaction: transactionDb });

    // Create the escrow transaction
    const escrowTransaction = await EscrowTransaction.create({
      escrowId,
      userId,
      type,
      amount,
      currency: escrow.currency,
      transactionReference,
      balanceAfterTransaction: newBalance,
      outstandingBalanceAfterTransaction: outstandingBalance,
      originalAmount: escrow.amount,
      status: 'COMPLETED',
      metadata: {
        ...metadata,
        description: `${type} transaction for escrow ${escrow.escrowUprn}`
      }
    }, { transaction: transactionDb });

    // Update wallet balance
    userWallet.balance -= Number(amount);
    await userWallet.save({ transaction: transactionDb });

    // Update escrow balance and store the transaction reference
    await escrow.update({ currentBalance: newBalance, status: outstandingBalance === 0 ? 'FUNDED' : 'PARTIALLY_FUNDED' }, { transaction: transactionDb });

    // Save both transactions
    await transactionDb.commit();

    res.status(201).json({
      success: true,
      data: {
        ...escrowTransaction.toJSON(),
        transactionReference
      }
    });
  } catch (error) {
    await transactionDb.rollback();
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction',
      error: error.message
    });
  }
};

// Get transactions for an escrow
exports.getEscrowTransactions = async (req, res) => {
  try {
    const { escrowId } = req.params;
    const transactions = await EscrowTransaction.findAll({ where: { escrowId }, include: [{ association: 'User', attributes: ['firstName', 'surname', 'email'] }], order: [['createdAt', 'DESC']] });

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

// Get transaction by reference
exports.getTransactionByReference = async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await EscrowTransaction.findOne({ where: { transactionReference: reference }, include: [{ association: 'User', attributes: ['firstName', 'surname', 'email'] }, Escrow] });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await EscrowTransaction.findByPk(transactionId, { include: [{ association: 'User', attributes: ['firstName', 'surname', 'email'] }, Escrow] });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

// Update transaction status
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    const transaction = await EscrowTransaction.findByPk(transactionId);
    if (transaction) await transaction.update({ status });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction',
      error: error.message
    });
  }
}; 
