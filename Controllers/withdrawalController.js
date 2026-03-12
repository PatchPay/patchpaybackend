const WithdrawalPayment = require('../models/WithdrawalPayment');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const mongoose = require('mongoose');
const { generateUPRN, generateStaticUserUPRN } = require('../utils/paymentUtils');
const squadApi = require('../utils/squadApiUtils');

/**
 * Initiate a withdrawal request
 * @route POST /api/payments/withdrawal/initiate
 */
exports.initiateWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get user from middleware
    const user = req.user;
    
    // Get withdrawal details from request body
    const { 
      amount, 
      bankCode, 
      accountNumber, 
      accountName, 
      description 
    } = req.body;
    
    // Validate required fields
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount'
      });
    }
    
    if (!bankCode || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Bank details are required'
      });
    }
    
    // Find user's wallet
    const wallet = await Wallet.findOne({ userId: user._id }).session(session);
    
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Check if wallet has sufficient balance
    if (wallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Generate UPRN for this withdrawal
    const withdrawalUprn = generateUPRN(user._id, 'withdrawal');
    
    // Generate transaction reference
    const transactionRef = `WDR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Create withdrawal payment record
    const withdrawalPayment = new WithdrawalPayment({
      userId: user._id,
      amount,
      currency: wallet.currency,
      transactionRef,
      bankCode,
      accountNumber,
      accountName,
      status: 'pending'
    });
    
    await withdrawalPayment.save({ session });
    
    // Create transaction record
    const transaction = new Transaction({
      senderId: user._id,
      senderWallet: wallet._id,
      amount,
      currency: wallet.currency,
      type: 'withdrawal',
      status: 'pending',
      reference: withdrawalUprn,
      isUserAccountTransfer: true, // This is a transfer from a user account
      description: description || 'Withdrawal from wallet',
      paymentMethod: 'bank_transfer',
      metadata: {
        withdrawalDetails: {
          accountName,
          accountNumber,
          bankCode
        },
        transactionRef
      }
    });
    
    await transaction.save({ session });
    
    // Deduct amount from wallet (immediately to prevent double spending)
    wallet.balance -= amount;
    await wallet.save({ session });
    
    // Initiate withdrawal with Squad API
    try {
      const withdrawalData = {
        amount,
        bankCode,
        accountNumber,
        accountName,
        currency: wallet.currency,
        transactionRef,
        description: description || 'Withdrawal from wallet',
        userId: user._id.toString(),
        uprn: withdrawalUprn
      };
      
      const squadResponse = await squadApi.initiateWithdrawal(withdrawalData);
      
      // Update withdrawal payment with Squad response
      withdrawalPayment.gatewayResponse = squadResponse;
      withdrawalPayment.status = 'processing'; // Squad is processing the withdrawal
      withdrawalPayment.squadRef = squadResponse.data?.reference || null;
      await withdrawalPayment.save({ session });
      
      // Also update transaction status
      transaction.status = 'processing';
      transaction.externalReference = squadResponse.data?.reference || null;
      await transaction.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      return res.status(200).json({
        success: true,
        message: 'Withdrawal initiated successfully',
        data: {
          withdrawal: {
            id: withdrawalPayment._id,
            transactionRef,
            squadRef: squadResponse.data?.reference,
            amount,
            currency: wallet.currency,
            status: withdrawalPayment.status
          },
          transaction: {
            id: transaction._id,
            reference: withdrawalUprn,
            amount,
            currency: wallet.currency,
            status: transaction.status
          }
        }
      });
    } catch (error) {
      console.error('Error initiating withdrawal with Squad:', error);
      
      // If Squad API fails, mark as failed and return remaining balance to wallet
      withdrawalPayment.status = 'failed';
      withdrawalPayment.errorMessage = error.response?.data?.message || error.message;
      withdrawalPayment.errorCode = error.response?.status || 'NETWORK_ERROR';
      await withdrawalPayment.save({ session });
      
      // Update transaction status
      transaction.status = 'failed';
      await transaction.save({ session });
      
      // Return funds to wallet
      wallet.balance += amount;
      await wallet.save({ session });
      
      // Commit the transaction (even in failure case, we need to record this)
      await session.commitTransaction();
      session.endSession();
      
      return res.status(500).json({
        success: false,
        message: 'Failed to process withdrawal',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error initiating withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate withdrawal',
      error: error.message
    });
  }
};

/**
 * Verify a withdrawal status
 * @route POST /api/payments/withdrawal/verify
 */
exports.verifyWithdrawal = async (req, res) => {
  try {
    const { transactionRef } = req.body;
    
    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required'
      });
    }
    
    // Find the withdrawal payment
    const withdrawalPayment = await WithdrawalPayment.findOne({ transactionRef });
    
    if (!withdrawalPayment) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }
    
    // If withdrawal is already completed (successful or failed), return current status
    if (['successful', 'failed'].includes(withdrawalPayment.status)) {
      // Get transaction details
      const transaction = await Transaction.findOne({ 
        'metadata.transactionRef': transactionRef
      });
      
      return res.status(200).json({
        success: true,
        message: `Withdrawal status: ${withdrawalPayment.status}`,
        data: {
          withdrawal: {
            id: withdrawalPayment._id,
            transactionRef: withdrawalPayment.transactionRef,
            squadRef: withdrawalPayment.squadRef,
            amount: withdrawalPayment.amount,
            currency: withdrawalPayment.currency,
            status: withdrawalPayment.status,
            createdAt: withdrawalPayment.createdAt
          },
          transaction: transaction ? {
            id: transaction._id,
            reference: transaction.reference,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt
          } : null
        }
      });
    }
    
    // Check status with Squad API if still processing
    try {
      const statusResponse = await squadApi.getWithdrawalStatus(transactionRef);
      
      // Update withdrawal with verification response
      withdrawalPayment.gatewayResponse = statusResponse;
      
      let newStatus = 'processing';
      
      // Map Squad API status to our status
      if (statusResponse.status === 200) {
        const transferStatus = statusResponse.data?.status || 'processing';
        
        if (['successful', 'success', 'completed'].includes(transferStatus.toLowerCase())) {
          newStatus = 'successful';
        } else if (['failed', 'failure', 'declined', 'rejected'].includes(transferStatus.toLowerCase())) {
          newStatus = 'failed';
          withdrawalPayment.errorMessage = statusResponse.data?.message || 'Withdrawal failed';
        }
      }
      
      // Update withdrawal status
      withdrawalPayment.status = newStatus;
      await withdrawalPayment.save();
      
      // Find and update transaction status
      const transaction = await Transaction.findOne({ 
        'metadata.transactionRef': transactionRef
      });
      
      if (transaction) {
        transaction.status = newStatus === 'successful' ? 'completed' : newStatus;
        await transaction.save();
        
        // If withdrawal failed, return funds to wallet
        if (newStatus === 'failed') {
          const wallet = await Wallet.findById(transaction.senderWallet);
          if (wallet) {
            wallet.balance += transaction.amount;
            await wallet.save();
          }
        }
      }
      
      return res.status(200).json({
        success: true,
        message: `Withdrawal status: ${newStatus}`,
        data: {
          withdrawal: {
            id: withdrawalPayment._id,
            transactionRef: withdrawalPayment.transactionRef,
            squadRef: withdrawalPayment.squadRef,
            amount: withdrawalPayment.amount,
            currency: withdrawalPayment.currency,
            status: withdrawalPayment.status,
            createdAt: withdrawalPayment.createdAt
          },
          transaction: transaction ? {
            id: transaction._id,
            reference: transaction.reference,
            amount: transaction.amount,
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt
          } : null
        }
      });
    } catch (error) {
      console.error('Error verifying withdrawal with Squad:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to verify withdrawal status',
        error: error.response?.data?.message || error.message
      });
    }
  } catch (error) {
    console.error('Error verifying withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify withdrawal',
      error: error.message
    });
  }
};

/**
 * Process Squad webhook for withdrawal status updates
 * @route POST /api/payments/withdrawal/webhook
 */
exports.webhookHandler = async (req, res) => {
  try {
    // Verify webhook signature (implementation depends on Squad API requirements)
    // ...
    
    const event = req.body;
    console.log('Received withdrawal webhook:', event);
    
    // Extract transaction reference from webhook
    const transactionRef = event.data?.transaction_ref || event.data?.reference;
    
    if (!transactionRef) {
      console.error('No transaction reference in webhook');
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }
    
    // Find withdrawal by transaction reference
    const withdrawalPayment = await WithdrawalPayment.findOne({ 
      $or: [
        { transactionRef },
        { squadRef: transactionRef }
      ]
    });
    
    if (!withdrawalPayment) {
      console.error(`Withdrawal not found for transaction ref: ${transactionRef}`);
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }
    
    // If withdrawal is already processed, ignore
    if (['successful', 'failed'].includes(withdrawalPayment.status)) {
      return res.status(200).json({ success: true, message: 'Withdrawal already processed' });
    }
    
    // Map webhook event status to our status
    const status = event.data?.status || 'processing';
    let newStatus = 'processing';
    
    if (['successful', 'success', 'completed'].includes(status.toLowerCase())) {
      newStatus = 'successful';
    } else if (['failed', 'failure', 'declined', 'rejected'].includes(status.toLowerCase())) {
      newStatus = 'failed';
      withdrawalPayment.errorMessage = event.data?.message || 'Withdrawal failed';
    }
    
    // Update withdrawal status
    withdrawalPayment.status = newStatus;
    withdrawalPayment.gatewayResponse = event.data;
    withdrawalPayment.gatewayResponseCode = event.data?.response_code || '';
    await withdrawalPayment.save();
    
    // Find and update transaction status
    const transaction = await Transaction.findOne({ 
      'metadata.transactionRef': withdrawalPayment.transactionRef
    });
    
    if (transaction) {
      transaction.status = newStatus === 'successful' ? 'completed' : newStatus;
      await transaction.save();
      
      // If withdrawal failed, return funds to wallet
      if (newStatus === 'failed') {
        const wallet = await Wallet.findById(transaction.senderWallet);
        if (wallet) {
          wallet.balance += transaction.amount;
          await wallet.save();
        }
      }
    }
    
    console.log(`Withdrawal ${newStatus}: ${withdrawalPayment.amount} ${withdrawalPayment.currency} for user ${withdrawalPayment.userId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing error',
      error: error.message
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
        message: 'Failed to retrieve banks list'
      });
    }
    
    // Format banks data
    const banks = banksResponse.data?.map(bank => ({
      code: bank.code,
      name: bank.name
    })) || [];
    
    return res.status(200).json({
      success: true,
      data: { banks }
    });
  } catch (error) {
    console.error('Error getting banks list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get banks list',
      error: error.message
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
        message: 'Account number and bank code are required'
      });
    }
    
    const accountResponse = await squadApi.resolveBankAccount(accountNumber, bankCode);
    
    if (!accountResponse || accountResponse.status !== 200) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve bank account'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        accountName: accountResponse.data?.account_name,
        accountNumber,
        bankCode
      }
    });
  } catch (error) {
    console.error('Error resolving bank account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve bank account',
      error: error.response?.data?.message || error.message
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
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      id: withdrawal._id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      accountNumber: withdrawal.accountNumber,
      accountName: withdrawal.accountName,
      status: withdrawal.status,
      transactionRef: withdrawal.transactionRef,
      createdAt: withdrawal.createdAt
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        withdrawals: formattedWithdrawals,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting withdrawal history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal history',
      error: error.message
    });
  }
}; 