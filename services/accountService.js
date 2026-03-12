const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { generateAccountNumber, generateTransactionReference } = require('../utils/accountUtils');

/**
 * Create or initialize a wallet for a user
 * 
 * @param {string} userId - User ID to create wallet for
 * @param {string} currency - Default currency (NGN, USD, etc.)
 * @param {string} accountType - Type of account (personal, merchant, ngo, government)
 * @returns {Promise<Object>} - Newly created wallet
 */
exports.createWallet = async (userId, currency = 'NGN', accountType = 'personal') => {
  try {
    // Check if user already has a wallet of this account type
    const existingWallet = await Wallet.findOne({ userId, accountType });
    
    if (existingWallet) {
      return existingWallet;
    }
    
    // Get user details for country code
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate account number using country code from user and requested account type
    const accountNumber = generateAccountNumber(user.countryCode || 'NG', accountType);
    
    // Create new wallet
    const wallet = new Wallet({
      userId,
      accountNumber,
      balance: 0,
      currency,
      accountType
    });
    
    await wallet.save();
    return wallet;
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
};

/**
 * Get wallet details for a user
 * 
 * @param {string} userId - User ID to get wallet for
 * @param {string} accountType - Type of account (personal, merchant, ngo, government)
 * @returns {Promise<Object>} - Wallet details
 */
exports.getWallet = async (userId, accountType = 'personal') => {
  try {
    const wallet = await Wallet.findOne({ userId, accountType });
    
    if (!wallet) {
      throw new Error(`Wallet not found for account type: ${accountType}`);
    }
    
    return wallet;
  } catch (error) {
    console.error('Error getting wallet:', error);
    throw error;
  }
};

/**
 * Get wallet by account number
 * 
 * @param {string} accountNumber - Account number to find
 * @returns {Promise<Object>} - Wallet details
 */
exports.getWalletByAccountNumber = async (accountNumber) => {
  try {
    const wallet = await Wallet.findOne({ accountNumber });
    
    if (!wallet) {
      throw new Error('Wallet not found for this account number');
    }
    
    return wallet;
  } catch (error) {
    console.error('Error getting wallet by account number:', error);
    throw error;
  }
};

/**
 * Transfer funds between two users
 * 
 * @param {string} senderId - User ID of sender
 * @param {string} recipientAccountNumber - Account number of recipient
 * @param {number} amount - Amount to transfer
 * @param {string} description - Transfer description
 * @returns {Promise<Object>} - Transaction details
 */
exports.transferFunds = async (senderId, recipientAccountNumber, amount, description = 'Transfer') => {
  // Start a database transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Get sender's wallet
    const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
    
    if (!senderWallet) {
      throw new Error('Sender wallet not found');
    }
    
    // Check if sender has sufficient funds
    if (senderWallet.balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Get recipient's wallet by account number
    const recipientWallet = await Wallet.findOne({ accountNumber: recipientAccountNumber }).session(session);
    
    if (!recipientWallet) {
      throw new Error('Recipient account not found');
    }
    
    // Check if wallets use same currency (for simplicity)
    if (senderWallet.currency !== recipientWallet.currency) {
      throw new Error('Currency mismatch. Cannot transfer between different currencies');
    }
    
    // Generate transaction reference
    const reference = generateTransactionReference();
    
    // Update sender's balance
    senderWallet.balance -= amount;
    await senderWallet.save({ session });
    
    // Update recipient's balance
    recipientWallet.balance += amount;
    await recipientWallet.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      type: 'transfer',
      amount,
      currency: senderWallet.currency,
      status: 'completed',
      senderWallet: senderWallet._id,
      senderId,
      recipientWallet: recipientWallet._id,
      recipientId: recipientWallet.userId,
      reference,
      description
    });
    
    await transaction.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    
    // End session
    session.endSession();
    
    return transaction;
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error transferring funds:', error);
    throw error;
  }
};

/**
 * Deposit funds into a user's wallet
 * 
 * @param {string} userId - User ID to deposit to
 * @param {number} amount - Amount to deposit
 * @param {string} description - Deposit description
 * @param {string} externalReference - External reference (e.g., payment gateway reference)
 * @returns {Promise<Object>} - Transaction details
 */
exports.depositFunds = async (userId, amount, description = 'Deposit', externalReference = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Get user's wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    // Generate transaction reference
    const reference = generateTransactionReference();
    
    // Update wallet balance
    wallet.balance += amount;
    await wallet.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      type: 'deposit',
      amount,
      currency: wallet.currency,
      status: 'completed',
      recipientWallet: wallet._id,
      recipientId: userId,
      reference,
      description,
      externalReference
    });
    
    await transaction.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    
    // End session
    session.endSession();
    
    return transaction;
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error depositing funds:', error);
    throw error;
  }
};

/**
 * Get transaction history for a user
 * 
 * @param {string} userId - User ID to get transactions for
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} - Transaction history
 */
exports.getTransactionHistory = async (userId, options = {}) => {
  try {
    const { limit = 10, skip = 0, sort = { createdAt: -1 } } = options;
    
    // Find transactions where user is either sender or recipient
    const transactions = await Transaction.find({
      $or: [
        { senderId: userId },
        { recipientId: userId }
      ]
    })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'firstName surname email')
    .populate('recipientId', 'firstName surname email');
    
    return transactions;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    throw error;
  }
};

/**
 * Get account balance for a user
 * 
 * @param {string} userId - User ID to get balance for
 * @returns {Promise<Object>} - Balance information
 */
exports.getBalance = async (userId) => {
  try {
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    return {
      balance: wallet.balance,
      currency: wallet.currency,
      accountNumber: wallet.accountNumber
    };
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}; 