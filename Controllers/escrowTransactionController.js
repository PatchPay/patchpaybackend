const EscrowTransaction = require('../models/EscrowTransaction');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Create a new escrow transaction
exports.createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, type, metadata } = req.body;
    const escrowId = req.params.id;
    const userId = req.user._id; // From auth middleware

    // Get the escrow details
    const escrow = await Escrow.findById(escrowId).session(session);
    if (!escrow) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Escrow not found' });
    }

    // Get user's wallet
    const userWallet = await Wallet.findOne({ 
      userId: userId,
      currency: escrow.currency,
      isActive: true 
    }).session(session);

    if (!userWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User wallet not found' });
    }

    // Check if user has sufficient balance
    if (userWallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
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
    const walletTransaction = new Transaction({
      type: 'transfer',
      amount: amount,
      fee: 0,
      total: amount,
      currency: escrow.currency,
      status: 'completed',
      senderWallet: userWallet._id,
      senderId: userId,
      recipientId: escrow.recipientId,
      reference: transactionReference,
      description: `Escrow funding: ${escrow.escrowUprn}`,
      isUserAccountTransfer: true,
      metadata: {
        escrowId: escrow._id,
        escrowUprn: escrow.escrowUprn,
        transactionType: 'ESCROW_FUND'
      }
    });

    // Create the escrow transaction
    const escrowTransaction = new EscrowTransaction({
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
    });

    // Update wallet balance
    await Wallet.findByIdAndUpdate(
      userWallet._id,
      { $inc: { balance: -amount } },
      { session }
    );

    // Update escrow balance and store the transaction reference
    await Escrow.findByIdAndUpdate(
      escrowId,
      {
        currentBalance: newBalance,
        status: outstandingBalance === 0 ? 'FUNDED' : 'PARTIALLY_FUNDED',
        $push: {
          transactionReferences: {
            reference: transactionReference,
            type: type,
            amount: amount,
            date: new Date()
          }
        }
      },
      { session }
    );

    // Save both transactions
    await walletTransaction.save({ session });
    await escrowTransaction.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        ...escrowTransaction.toObject(),
        transactionReference
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
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
    const transactions = await EscrowTransaction.find({ escrowId })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email');

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
    const transaction = await EscrowTransaction.findOne({ transactionReference: reference })
      .populate('userId', 'firstName lastName email')
      .populate('escrowId');

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
    const transaction = await EscrowTransaction.findById(transactionId)
      .populate('userId', 'firstName lastName email')
      .populate('escrowId');

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

    const transaction = await EscrowTransaction.findByIdAndUpdate(
      transactionId,
      { status },
      { new: true }
    );

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