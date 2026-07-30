const { Op } = require('sequelize');
const { sequelize, Wallet, Transaction, User } = require('../models');
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
    const existingWallet = await Wallet.findOne({ where: { userId, accountType } });

    if (existingWallet) {
      return existingWallet;
    }

    // Get user details for country code
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate account number using country code from user and requested account type
    const accountNumber = generateAccountNumber(user.countryCode || 'NG', accountType);

    // Create new wallet
    const wallet = await Wallet.create({
      userId,
      accountNumber,
      balance: 0,
      currency,
      accountType
    });

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
    const wallet = await Wallet.findOne({ where: { userId, accountType } });

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
    const wallet = await Wallet.findOne({ where: { accountNumber } });

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
  const t = await sequelize.transaction();

  try {
    // Get sender's wallet (row-locked to avoid race conditions on balance)
    const senderWallet = await Wallet.findOne({
      where: { userId: senderId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!senderWallet) {
      throw new Error('Sender wallet not found');
    }

    // Check if sender has sufficient funds
    if (senderWallet.balance < amount) {
      throw new Error('Insufficient funds');
    }

    // Get recipient's wallet by account number
    const recipientWallet = await Wallet.findOne({
      where: { accountNumber: recipientAccountNumber },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

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
    await senderWallet.save({ transaction: t });

    // Update recipient's balance
    recipientWallet.balance += amount;
    await recipientWallet.save({ transaction: t });

    // Create transaction record
    const transaction = await Transaction.create(
      {
        type: 'transfer',
        amount,
        currency: senderWallet.currency,
        status: 'completed',
        senderWallet: senderWallet.id,
        senderId,
        recipientWallet: recipientWallet.id,
        recipientId: recipientWallet.userId,
        reference,
        description
      },
      { transaction: t }
    );

    // Commit the transaction
    await t.commit();

    return transaction;
  } catch (error) {
    // Roll back transaction on error
    await t.rollback();

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
  const t = await sequelize.transaction();

  try {
    // Get user's wallet (row-locked to avoid race conditions on balance)
    const wallet = await Wallet.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Generate transaction reference
    const reference = generateTransactionReference();

    // Update wallet balance
    wallet.balance += amount;
    await wallet.save({ transaction: t });

    // Create transaction record
    const transaction = await Transaction.create(
      {
        type: 'deposit',
        amount,
        currency: wallet.currency,
        status: 'completed',
        recipientWallet: wallet.id,
        recipientId: userId,
        reference,
        description,
        externalReference
      },
      { transaction: t }
    );

    // Commit the transaction
    await t.commit();

    return transaction;
  } catch (error) {
    // Roll back transaction on error
    await t.rollback();

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
    const { limit = 10, skip = 0, sort = [['createdAt', 'DESC']] } = options;

    // Find transactions where user is either sender or recipient
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [{ senderId: userId }, { recipientId: userId }]
      },
      order: sort,
      offset: skip,
      limit,
      include: [
        { model: User, as: 'sender', attributes: ['firstName', 'surname', 'email'] },
        { model: User, as: 'recipient', attributes: ['firstName', 'surname', 'email'] }
      ]
    });

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
    const wallet = await Wallet.findOne({ where: { userId } });

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