const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { generateAccountNumber, formatAmount } = require('../utils/accountUtils');
const { generateUPRN, generateStaticUserUPRN, validateNameMatch, transactionNeedsUPRN } = require('../utils/paymentUtils');
const { calculateTransactionFee, getCurrencyForUser } = require('../utils/transactionFeeUtils');
const Notification = require('../models/Notification');

/**
 * Initialize wallet for a user
 * @route POST /api/wallet/initialize
 */
exports.initializeWallet = async (req, res) => {
  try {
    console.log('Request to initialize wallet received');
    
    // Debug: Check what user data we have
    console.log('User in request:', req.user ? 'User exists' : 'No user');
    
    // Fix: Use _id as MongoDB stores IDs this way
    // The req.user might be a Mongoose model or plain object, handle both cases
    let userId;
    if (req.user) {
      userId = req.user._id ? req.user._id.toString() : req.user.id;
      console.log('Using userId:', userId);
    } else {
      console.error('No user attached to request');
      return res.status(401).json({
        success: false, 
        message: 'Authentication failed. User not found.'
      });
    }
    
    // Get only wallet type information from request
    // Ignoring country/currency from client for security
    const { accountType, walletType } = req.body;
    
    // Check if user exists in the database
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found in database with ID:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log('Found user in database:', user.email);
    
    // Log retrieved user data directly from database
    console.log('User country details from DB:', {
      country: user.country,
      countryCode: user.countryCode,
      continent: user.continent
    });
    
    // ENHANCED CHECK: Verify user has all required data for wallet initialization
    const missingData = [];
    if (!user.country) missingData.push('country');
    if (!user.countryCode) missingData.push('country code');
    if (!user.continent) missingData.push('continent');
    
    if (missingData.length > 0) {
      console.error(`User ${userId} is missing required profile data:`, missingData);
      return res.status(400).json({
        success: false,
        message: `Cannot initialize wallet: Your profile is missing the following required information: ${missingData.join(', ')}. Please update your profile before creating a wallet.`
      });
    }
    
    // Extra validation - ensure countryCode is a valid 2-letter code
    if (user.countryCode.length !== 2) {
      console.error(`User ${userId} has invalid country code format: ${user.countryCode}`);
      return res.status(400).json({
        success: false,
        message: `Cannot initialize wallet: Your profile has an invalid country code format. Country codes must be 2 letters (e.g., GB, US, NG).`
      });
    }
    
    // Always use the database information, not client-provided data
    const country = user.country;
    const countryCode = user.countryCode;
    const continent = user.continent;
    let currency;
    
    // Determine currency based on database user data only
    if (!currency) {
      try {
        // SPECIAL CASE: For United Kingdom, explicitly set GBP
        if (country === 'United Kingdom' || countryCode === 'GB') {
          console.log('🇬🇧 SPECIAL HANDLING FOR UK: Explicitly setting currency to GBP');
          currency = 'GBP';
        } else {
          // Create a user object using only database information
          const userWithCode = {...user.toObject()};
          currency = getCurrencyForUser(userWithCode);
          console.log(`Determined currency ${currency} based on user's database data`);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Cannot initialize wallet: ${error.message}. Please update your profile with a valid country.`
        });
      }
    }
    
    if (!currency) {
      console.error('Could not determine currency for user');
      return res.status(400).json({
        success: false,
        message: 'Cannot initialize wallet: Currency cannot be determined from your profile data. Please update your profile with a valid country.'
      });
    }
    
    console.log('Currency for wallet (from database):', currency);

    // Check if user is verified and active
    console.log('User verification status:', { 
      emailVerified: user.emailVerified, 
      status: user.status_client 
    });
    
    if (!user.emailVerified || user.status_client !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Account must be verified and active to initialize a wallet'
      });
    }

    // Check if user already has a wallet
    console.log('Checking for existing wallet...');
    let wallet = await Wallet.findOne({ userId: userId });
    
    if (wallet) {
      console.log(`User ${userId} already has a wallet with account ${wallet.accountNumber}`);
      return res.status(200).json({ 
        success: true, 
        message: 'Wallet already initialized',
        data: {
          accountNumber: wallet.accountNumber,
          balance: formatAmount(wallet.balance, wallet.currency),
          rawBalance: wallet.balance,
          availableBalance: formatAmount(wallet.balance, wallet.currency),
          rawAvailableBalance: wallet.balance,
          currency: wallet.currency,
          isActive: wallet.isActive
        }
      });
    }

    console.log('No existing wallet, creating new wallet...');
    
    // Generate account number based on user's country code
    if (!user.countryCode) {
      console.error('Cannot generate account number: User has no country code');
      return res.status(400).json({
        success: false,
        message: 'Cannot initialize wallet: Missing country code in user profile. Please update your profile with a valid country.'
      });
    }
    
    let accountNumber = generateAccountNumber(user.countryCode);
    console.log('Generated account number:', accountNumber);

    // Verify the account number is unique
    const existingAccountCheck = await Wallet.findOne({ accountNumber });
    if (existingAccountCheck) {
      console.error(`Generated duplicate account number: ${accountNumber}, regenerating...`);
      // If there's a collision, generate a new account number
      // This is unlikely but added as a safeguard
      accountNumber = generateAccountNumber(user.countryCode);
      console.log('Regenerated account number:', accountNumber);
    }

    // Create new wallet
    wallet = new Wallet({
      userId: userId,
      accountNumber,
      balance: 0,
      currency,
      isActive: true
    });

    console.log('About to save new wallet:', {
      userId: wallet.userId,
      accountNumber: wallet.accountNumber
    });
    
    try {
      await wallet.save();
      console.log(`Wallet created successfully for user ${userId} with account ${accountNumber}`);
    } catch (saveError) {
      console.error('Error saving wallet:', saveError);
      console.error('Wallet data attempted to save:', {
        userId,
        accountNumber,
        currency
      });
      throw saveError; // Re-throw to be caught by the outer try/catch
    }

    // Return the created wallet
    return res.status(201).json({
      success: true,
      message: 'Wallet initialized successfully',
      data: {
        accountNumber: wallet.accountNumber,
        balance: formatAmount(wallet.balance, wallet.currency),
        rawBalance: wallet.balance,
        availableBalance: formatAmount(wallet.balance, wallet.currency),
        rawAvailableBalance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive
      }
    });
  } catch (error) {
    console.error('Error initializing wallet:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize wallet',
      error: error.message
    });
  }
};

/**
 * Get wallet balance
 * @route GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user's wallet
    const wallet = await Wallet.findOne({ userId: userId });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Return the balance
    return res.status(200).json({
      success: true,
      data: {
        balance: formatAmount(wallet.balance, wallet.currency),
        rawBalance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet balance',
      error: error.message
    });
  }
};

/**
 * Get transaction history
 * @route GET /api/wallet/transactions
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`==== GET TRANSACTION HISTORY - USER ${userId} ====`);
    
    const { limit = 5, skip = 0 } = req.query;
    
    // Create query to find transactions for this user
    const query = {
      $or: [
        { senderId: userId },   // User is sender
        { recipientId: userId } // User is recipient
      ]
    };
    
    // Add additional query parameters if provided
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Count total transactions
    const total = await Transaction.countDocuments(query);
    
    // Get transactions with pagination
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('senderId recipientId', 'firstName lastName email businessName organizationName departmentName accountType');
      
    console.log(`Found ${transactions.length} transactions for user ${userId}`);
    
    // Format transactions for response
    const formattedTransactions = transactions.map(transaction => {
      // EXPLICIT ID EXTRACTION - For debugging purposes, log every step
      // Extract sender ID as string, with detailed logging
      let senderIdStr;
      if (transaction.senderId) {
        if (typeof transaction.senderId === 'object' && transaction.senderId._id) {
          // It's a populated Mongoose object
          senderIdStr = transaction.senderId._id.toString();
          console.log(`Sender is a populated object. Extracted ID: ${senderIdStr}`);
        } else {
          // It's already an ID (string or ObjectId)
          senderIdStr = transaction.senderId.toString();
          console.log(`Sender is a raw ID. Converted to string: ${senderIdStr}`);
        }
      } else {
        senderIdStr = '';
        console.log('No sender ID found in transaction');
      }
      
      // Extract recipient ID as string, with detailed logging
      let recipientIdStr;
      if (transaction.recipientId) {
        if (typeof transaction.recipientId === 'object' && transaction.recipientId._id) {
          // It's a populated Mongoose object
          recipientIdStr = transaction.recipientId._id.toString();
          console.log(`Recipient is a populated object. Extracted ID: ${recipientIdStr}`);
        } else {
          // It's already an ID (string or ObjectId)
          recipientIdStr = transaction.recipientId.toString();
          console.log(`Recipient is a raw ID. Converted to string: ${recipientIdStr}`);
        }
      } else {
        recipientIdStr = '';
        console.log('No recipient ID found in transaction');
      }
      
      // Convert current user ID to string
      const userIdStr = userId.toString();
      console.log(`Current user ID as string: ${userIdStr}`);
      
      // EXPLICIT COMPARISON - Compare string values, not objects
      const isOutgoing = senderIdStr === userIdStr;
      console.log(`DIRECTION DETERMINATION: ${senderIdStr} === ${userIdStr} = ${isOutgoing}`);
      console.log(`Setting direction to: ${isOutgoing ? 'outgoing' : 'incoming'}`);
      
      // Get the counterparty based on transaction direction
      const counterparty = isOutgoing ? transaction.recipientId : transaction.senderId;
      
      // Extract counterparty ID
      let counterpartyId;
      if (counterparty) {
        if (typeof counterparty === 'object' && counterparty._id) {
          counterpartyId = counterparty._id.toString();
        } else {
          counterpartyId = counterparty.toString();
        }
      } else {
        counterpartyId = '';
      }
      
      // Determine counterparty name based on account type
      let counterpartyName = 'Unknown';
      if (counterparty) {
        if (counterparty.firstName) {
          // Personal account
          counterpartyName = `${counterparty.firstName} ${counterparty.lastName || ''}`.trim();
        } else if (counterparty.businessName) {
          // Merchant account
          counterpartyName = counterparty.businessName;
        } else if (counterparty.organizationName) {
          // NGO account
          counterpartyName = counterparty.organizationName;
        } else if (counterparty.departmentName) {
          // Government account
          counterpartyName = counterparty.departmentName;
        } else if (counterparty.email) {
          // Fallback to email
          counterpartyName = counterparty.email;
        }
      }
      
      return {
        id: transaction._id,
        type: transaction.type,
        amount: formatAmount(isOutgoing ? -transaction.total : transaction.amount, transaction.currency),
        fee: formatAmount(transaction.fee, transaction.currency),
        total: formatAmount(transaction.total, transaction.currency),
        currency: transaction.currency,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        status: transaction.status,
        date: transaction.createdAt,
        reference: transaction.reference,
        description: transaction.description || '',
        paymentMethod: transaction.paymentMethod,
        // Add sender and recipient IDs explicitly for frontend debugging
        senderId: senderIdStr,
        recipientId: recipientIdStr,
        counterparty: counterparty ? {
          id: counterpartyId,
          name: counterpartyName,
          email: counterparty.email || '',
          accountType: counterparty.accountType || 'Unknown'
        } : null
      };
    });
    
    // Return transaction history
    return res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      }
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history',
      error: error.message
    });
  }
};

/**
 * Transfer funds from one wallet to another
 * @route POST /api/wallet/transfer
 */
exports.transferFunds = async (req, res) => {
  // Start a transaction session
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { recipientAccount, amount, description } = req.body;
    const senderId = req.user._id;
    
    // Validate input
    if (!recipientAccount || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Recipient account and amount are required'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }
    
    // Find sender's wallet
    const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
    
    if (!senderWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Sender wallet not found'
      });
    }
    
    console.log(`Sender Wallet ID: ${senderWallet._id}`);
    console.log(`Sender Account Balance: ${senderWallet.balance}`);
    
    // Check if sender has sufficient funds
    // Calculate available balance by subtracting pending transaction amounts
    const pendingTransactions = await Transaction.find({
      senderId: senderId,
      status: 'pending'
    }).session(session);

    // Calculate pending amount that should be subtracted from balance
    let pendingAmount = 0;
    pendingTransactions.forEach(transaction => {
      pendingAmount += transaction.amount;
    });

    // Calculate available balance
    const availableBalance = Math.max(0, senderWallet.balance - pendingAmount);
    console.log(`Sender Available Balance: ${availableBalance}`);

    // Find recipient's wallet
    const recipientWallet = await Wallet.findOne({ accountNumber: recipientAccount }).session(session);
    
    if (!recipientWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Recipient account not found'
      });
    }
    
    // Get recipient user
    const recipientUser = await User.findById(recipientWallet.userId).session(session);
    const recipientUserId = recipientUser?._id;
    
    console.log(`Recipient Wallet ID: ${recipientWallet._id}`);
    console.log(`Recipient User ID: ${recipientUserId}`);

    if (!recipientUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found'
      });
    }

    // Get sender user data for complete transaction information
    const senderUser = await User.findById(senderId).session(session);
    
    if (!senderUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Sender user not found'
      });
    }

    // Prevent transfers to self
    if (senderId.toString() === recipientUser._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }
    
    // Calculate transaction fee
    const feeDetails = calculateTransactionFee(senderUser, recipientUser, amount);
    console.log('Transaction fee details:', feeDetails);
    
    // Calculate total
    const calculatedTotal = amount + feeDetails.feeAmount;
    
    // Use provided total if it matches calculated total
    const total = req.body.total ? parseFloat(req.body.total) : calculatedTotal;
    
    // Validate that provided total matches calculated total
    if (Math.abs(total - calculatedTotal) > 0.01) { // Allow for small floating point differences
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid total amount. Expected ${formatAmount(calculatedTotal, senderWallet.currency)} (including ${formatAmount(feeDetails.feeAmount, senderWallet.currency)} fee)`
      });
    }

    if (availableBalance < total) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient available balance. Transaction requires ${formatAmount(total, senderWallet.currency)} (including ${formatAmount(feeDetails.feeAmount, senderWallet.currency)} fee)`
      });
    }

    // Generate UPRN for this transfer - This is a user account transfer
    const transferUprn = generateUPRN(senderId, 'transfer');
    
    // Generate static UPRNs for both users if they don't already have them
    const senderStaticUprn = generateStaticUserUPRN(senderId);
    const recipientStaticUprn = generateStaticUserUPRN(recipientUser._id);

    // Customize description if not provided
    const finalDescription = description || `Transfer from ${senderUser.firstName || senderUser.email} to ${recipientUser.firstName || recipientUser.email}`;

    // Create transaction record
    const transaction = new Transaction({
      // Sender details
      senderId: senderId,
      senderWallet: senderWallet._id,
      
      // Recipient details
      recipientId: recipientUser._id,
      recipientWallet: recipientWallet._id,
      
      // Transaction details
      amount,
      fee: feeDetails.feeAmount,
      total,
      currency: senderWallet.currency,
      type: 'transfer',
      status: 'completed',
      reference: transferUprn,
      isUserAccountTransfer: true, // This is a transfer between user accounts
      staticUserUprn: senderStaticUprn, // Associate with sender's static UPRN
      description: finalDescription,
      verificationStatus: 'not_required', // Direct transfers don't need verification
      paymentMethod: 'wallet',
      paymentGateway: feeDetails.paymentGateway,
      
      // Additional metadata to help with display
      metadata: {
        senderName: senderUser.firstName ? `${senderUser.firstName} ${senderUser.lastName || ''}`.trim() : senderUser.email,
        recipientName: recipientUser.firstName ? `${recipientUser.firstName} ${recipientUser.lastName || ''}`.trim() : recipientUser.email,
        senderAccountType: senderUser.accountType || 'Personal',
        recipientAccountType: recipientUser.accountType || 'Personal',
        feeDetails: {
          amount: feeDetails.feeAmount,
          percentage: feeDetails.feePercentage,
          flatFee: feeDetails.flatFee,
          description: feeDetails.feeDescription,
          isInternational: feeDetails.isInternational,
          isCrossContinental: feeDetails.isCrossContinental
        }
      }
    });
    
    const transactionId = transaction._id;
    console.log(`Created Transaction ID: ${transactionId}`);
    console.log(`Transaction Direction: sender=${senderId}, recipient=${recipientUserId}`);

    await transaction.save({ session });

    // Update sender's balance (deduct amount + fee)
    senderWallet.balance -= total;
    await senderWallet.save({ session });

    // Update recipient's balance (add amount)
    recipientWallet.balance += amount;
    await recipientWallet.save({ session });

    // Create notifications for both sender and recipient
    const senderNotification = new Notification({
      recipientId: senderId,
      senderId: senderId,
      title: "Transfer Sent",
      message: `You have sent ${senderWallet.currency} ${amount.toLocaleString()} to ${recipientUser.firstName}${recipientUser.lastName ? ' ' + recipientUser.lastName : ''}`,
      type: "success",
      category: "transfer",
      metadata: {
        transferId: transactionId,
        amount,
        recipientName: `${recipientUser.firstName}${recipientUser.lastName ? ' ' + recipientUser.lastName : ''}`,
        recipientAccount: recipientWallet.accountNumber,
        fee: feeDetails.feeAmount,
        total,
        type: "outgoing"
      }
    });

    const recipientNotification = new Notification({
      recipientId: recipientUser._id,
      senderId: senderId,
      title: "Transfer Received",
      message: `${senderUser.firstName}${senderUser.lastName ? ' ' + senderUser.lastName : ''} has sent you ${senderWallet.currency} ${amount.toLocaleString()}`,
      type: "success",
      category: "transfer",
      metadata: {
        transferId: transactionId,
        amount,
        senderName: `${senderUser.firstName}${senderUser.lastName ? ' ' + senderUser.lastName : ''}`,
        senderAccount: senderWallet.accountNumber,
        type: "incoming"
      }
    });

    // Save notifications within the session
    await Promise.all([
      senderNotification.save({ session }),
      recipientNotification.save({ session })
    ]);

    // Log notification creation
    console.log('Created notifications:', {
      senderNotificationId: senderNotification._id,
      recipientNotificationId: recipientNotification._id,
      senderMessage: senderNotification.message,
      recipientMessage: recipientNotification.message
    });

    // Commit the transaction
    await session.commitTransaction();
    
    // Return success response with transaction details
    res.status(200).json({
      success: true,
      data: {
        transactionId,
        senderName: `${senderUser.firstName} ${senderUser.lastName}`,
        recipientName: `${recipientUser.firstName} ${recipientUser.lastName}`,
        senderAccount: senderWallet.accountNumber,
        recipientAccount: recipientWallet.accountNumber,
        amount,
        fee: feeDetails.feeAmount,
        total,
        currency: senderWallet.currency,
        senderBalance: senderWallet.balance
      }
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    console.error('Error in transferFunds:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error processing transfer'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get wallet details including account and available balance
 */
exports.getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user's wallet
    const wallet = await Wallet.findOne({ userId: userId });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Calculate available balance by subtracting pending transaction amounts
    const pendingTransactions = await Transaction.find({
      $or: [
        { senderId: userId, status: 'pending' },
        { recipientId: userId, status: 'pending' }
      ]
    });

    // Calculate pending amount that should be subtracted from balance
    let pendingAmount = 0;
    pendingTransactions.forEach(transaction => {
      // If user is sender, subtract the amount
      if (transaction.senderId && transaction.senderId.toString() === userId.toString()) {
        pendingAmount += transaction.amount;
      }
      // We don't add pending incoming funds to available balance
    });

    // Calculate available balance
    const availableBalance = Math.max(0, wallet.balance - pendingAmount);

    // Return wallet details with both balances
    return res.status(200).json({
      success: true,
      data: {
        accountNumber: wallet.accountNumber,
        balance: Number(wallet.balance),
        rawBalance: Number(wallet.balance),
        availableBalance: Number(availableBalance),
        rawAvailableBalance: Number(availableBalance),
        currency: wallet.currency,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting wallet details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet details',
      error: error.message
    });
  }
};

/**
 * Verify if an account number exists and get user info
 * @route GET /api/wallet/verify-account/:accountNumber
 */
exports.verifyAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;
    
    if (!accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Account number is required'
      });
    }
    
    // Prevent verifying your own account
    const userWallet = await Wallet.findOne({ userId: req.user.id });
    if (userWallet && userWallet.accountNumber === accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add your own account as a recipient'
      });
    }
    
    // Find wallet by account number
    const wallet = await Wallet.findOne({ accountNumber });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    // Get user associated with the wallet
    const user = await User.findById(wallet.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User associated with this account not found'
      });
    }
    
    // Get full name based on account type
    let fullName = '';
    
    if (user.accountType === 'Personal') {
      // For personal accounts, use first name, middle name, and surname
      fullName = `${user.firstName || ''} ${user.middleName || ''} ${user.surname || ''}`.trim();
    } else if (user.accountType === 'NGO') {
      // For NGO accounts, use organization name
      fullName = user.organizationName || '';
    } else if (user.accountType === 'Merchant') {
      // For Merchant accounts, use business name
      fullName = user.businessName || '';
    } else if (user.accountType === 'Government') {
      // For Government accounts, use department name
      fullName = user.departmentName || '';
    } else {
      // Fallback to email if no identifiable name
      fullName = user.email || 'Anonymous User';
    }
    
    // Return limited user information (for privacy)
    return res.status(200).json({
      success: true,
      message: 'Account verified successfully',
      data: {
        accountNumber: wallet.accountNumber,
        userName: fullName,
        accountType: user.accountType,
        currency: wallet.currency
      }
    });
  } catch (error) {
    console.error('Error verifying account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify account',
      error: error.message
    });
  }
};

/**
 * Deposit funds
 * @route POST /api/wallet/deposit
 */
exports.depositFunds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, paymentMethod, paymentDetails = {} } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['card', 'bank_transfer', 'offline_transfer'];
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment method is required'
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }
    
    // Get user information for the transaction record
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate UPRN for this deposit
    const depositUprn = generateUPRN(userId, 'deposit');
    
    // Generate static user UPRN if not already generated
    const staticUserUprn = generateStaticUserUPRN(userId);
    
    // Use description from payment details or create a default one
    const depositDescription = paymentDetails.description || 'Deposit to wallet';

    // Create deposit transaction record - status will be pending initially
    const transaction = new Transaction({
      // For deposits, there's no sender, only a recipient (the user)
      recipientId: userId,
      recipientWallet: wallet._id,
      
      // Transaction details
      amount,
      currency: wallet.currency,
      type: 'deposit',
      status: 'pending', // Will be updated after payment is confirmed
      reference: depositUprn,
      isUserAccountTransfer: true, // This is a transfer to a user account
      staticUserUprn,
      description: depositDescription,
      paymentMethod,
      verificationStatus: 'pending', // Deposits require verification
      
      // Additional metadata
      metadata: {
        paymentDetails,
        nameOnPaymentMethod: paymentDetails.nameOnPayment || '',
        recipientName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        recipientAccountType: user.accountType || 'Personal'
      }
    });

    await transaction.save({ session });

    // For offline transfers, we don't immediately update the wallet balance
    // For card payments, we would integrate with a payment gateway here
    
    let response = {
      success: true,
      message: 'Deposit initiated successfully',
      data: {
        transaction: {
          id: transaction._id,
          reference: depositUprn,
          staticUserUprn,
          amount: formatAmount(amount, wallet.currency),
          currency: wallet.currency,
          status: transaction.status,
          paymentMethod,
          description: depositDescription
        }
      }
    };

    // For offline transfers, provide bank account information
    if (paymentMethod === 'offline_transfer') {
      response.data.bankDetails = {
        accountName: 'PatchPay Ltd',
        accountNumber: '1234567890',
        bankName: 'Sample Bank',
        reference: depositUprn, // Use UPRN as payment reference
        instructions: 'Please include the reference number in your payment description'
      };
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json(response);
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error initiating deposit:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate deposit',
      error: error.message
    });
  }
};

/**
 * Calculate transaction fee without performing the transaction
 * @route POST /api/wallet/calculate-fee
 */
exports.calculateFee = async (req, res) => {
  try {
    const { recipientAccount, amount } = req.body;
    const senderId = req.user._id;
    
    // Validate input
    if (!recipientAccount || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Recipient account and amount are required'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }
    
    // Find sender's wallet
    const senderWallet = await Wallet.findOne({ userId: senderId });
    
    if (!senderWallet) {
      return res.status(404).json({
        success: false,
        message: 'Sender wallet not found'
      });
    }
    
    // Find recipient's wallet
    const recipientWallet = await Wallet.findOne({ accountNumber: recipientAccount });
    
    if (!recipientWallet) {
      return res.status(404).json({
        success: false,
        message: 'Recipient account not found'
      });
    }
    
    // Get recipient user
    const recipientUser = await User.findById(recipientWallet.userId);
    
    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found'
      });
    }

    // Get sender user data
    const senderUser = await User.findById(senderId);
    
    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: 'Sender user not found'
      });
    }

    // Prevent transfers to self
    if (senderId.toString() === recipientUser._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }
    
    // Calculate transaction fee
    const feeDetails = calculateTransactionFee(senderUser, recipientUser, amount);
    console.log('Transaction fee details:', feeDetails);
    
    // Calculate total
    const total = amount + feeDetails.feeAmount;
    
    // Return fee details
    return res.status(200).json({
      success: true,
      data: {
        amount: formatAmount(amount, senderWallet.currency),
        rawAmount: amount,
        fee: formatAmount(feeDetails.feeAmount, senderWallet.currency),
        rawFee: feeDetails.feeAmount,
        total: formatAmount(total, senderWallet.currency),
        rawTotal: total,
        currency: senderWallet.currency,
        feeDetails: {
          percentage: feeDetails.feePercentage,
          flatFee: feeDetails.flatFee,
          description: feeDetails.feeDescription,
          isInternational: feeDetails.isInternational,
          isCrossContinental: feeDetails.isCrossContinental
        },
        paymentGateway: feeDetails.paymentGateway,
        recipientName: recipientUser.firstName ? `${recipientUser.firstName} ${recipientUser.lastName || ''}`.trim() : recipientUser.email
      }
    });
  } catch (error) {
    console.error('Error calculating transaction fee:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate transaction fee',
      error: error.message
    });
  }
}; 