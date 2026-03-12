const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Generate a Unique Payment Reference Number (UPRN)
 * This should ONLY be used for actual transfers to and from user accounts,
 * not for internal system operations.
 * 
 * @param {string} userId - User ID to associate with the UPRN
 * @param {string} transactionType - Type of transaction (transfer, deposit, withdrawal)
 * @param {Object} options - Additional options for UPRN generation
 * @returns {string} - A unique payment reference number
 */
exports.generateUPRN = (userId, transactionType, options = {}) => {
  // Get current timestamp in milliseconds
  const timestamp = Date.now();
  
  // Take the first 8 chars of userId (converted to string) to keep UPRN reasonably short
  const userFragment = userId.toString().substring(0, 8);
  
  // Get a 4-char random hex string for extra uniqueness
  const randomFragment = crypto.randomBytes(2).toString('hex');
  
  // Create prefix based on transaction type
  const prefixMap = {
    transfer: 'TRF',
    deposit: 'DEP',
    withdrawal: 'WDR',
    escrow_release: 'ESR',  // For money entering recipient's account
    escrow_refund: 'ESF'    // For money returning to creator's account
  };
  
  const prefix = prefixMap[transactionType] || 'PAY';
  
  // For escrow transactions, include escrow ID if provided
  let escrowFragment = '';
  if (options.escrowId) {
    escrowFragment = `-${options.escrowId.toString().substring(0, 6)}`;
  }
  
  // Combine all elements to create UPRN
  // Format: PREFIX-USERFRAGMENT-TIMESTAMP-RANDOM[-ESCROWFRAGMENT]
  // Example: TRF-5f8a9b2c-1624567890123-a1b2
  return `${prefix}-${userFragment}-${timestamp}-${randomFragment}${escrowFragment}`.toUpperCase();
};

/**
 * Generate a static UPRN for a user's deposits
 * This creates a consistent reference number for reconciling bank transfers
 * 
 * @param {string} userId - User ID to generate static UPRN for
 * @returns {string} - A static UPRN for the user
 */
exports.generateStaticUserUPRN = (userId) => {
  // Convert userId to string and take first 10 characters
  const userIdStr = userId.toString();
  const userFragment = userIdStr.substring(0, 10);
  
  // Create a hash of the userId for added uniqueness and verification
  const hash = crypto.createHash('md5').update(userIdStr).digest('hex').substring(0, 6);
  
  // Format: PP-USERFRAGMENT-HASH
  // Example: PP-5f8a9b2c3d-1a2b3c
  return `PP-${userFragment}-${hash}`.toUpperCase();
};

/**
 * Generate a UPRN specifically for escrow-related transfers to/from user accounts
 * Note: Only use this for actual money movements between user accounts and escrow,
 * not for internal escrow state changes.
 * 
 * @param {string} userId - User ID involved in the transfer
 * @param {string} escrowId - ID of the escrow record
 * @param {string} action - Escrow action (release, refund)
 * @returns {string} - A UPRN for the escrow transfer
 */
exports.generateEscrowTransferUPRN = (userId, escrowId, action) => {
  if (!['release', 'refund'].includes(action)) {
    throw new Error('Escrow UPRNs should only be generated for release or refund actions');
  }
  
  const escrowAction = `escrow_${action}`;
  return exports.generateUPRN(userId, escrowAction, { escrowId });
};

/**
 * Determine if a transaction needs a UPRN
 * Only transactions that directly affect user account balances need UPRNs
 * 
 * @param {string} transactionType - Type of transaction 
 * @param {Object} metadata - Transaction metadata
 * @returns {boolean} - Whether this transaction needs a UPRN
 */
exports.transactionNeedsUPRN = (transactionType, metadata = {}) => {
  // Internal escrow operations don't need UPRNs
  if (metadata.isInternalEscrowOperation) {
    return false;
  }
  
  // All direct transfers between users need UPRNs
  if (transactionType === 'transfer') {
    return true;
  }
  
  // Deposits and withdrawals need UPRNs
  if (['deposit', 'withdrawal'].includes(transactionType)) {
    return true;
  }
  
  // Escrow transfers to/from user accounts need UPRNs
  if (metadata.escrowType && ['funding', 'release', 'refund'].includes(metadata.escrowType)) {
    return true;
  }
  
  // By default, don't require a UPRN
  return false;
};

/**
 * Parse information from a UPRN
 * 
 * @param {string} uprn - The UPRN to parse
 * @returns {Object} - Parsed information from the UPRN
 */
exports.parseUPRN = (uprn) => {
  if (!uprn) return null;
  
  // Try to parse a standard transaction UPRN
  const standardPattern = /^([A-Z]+)-([A-Z0-9]+)-(\d+)-([A-Z0-9]+)(?:-([A-Z0-9]+))?$/;
  const match = uprn.match(standardPattern);
  
  if (!match) {
    // Try to parse a static user UPRN
    const staticPattern = /^PP-([A-Z0-9]+)-([A-Z0-9]+)$/;
    const staticMatch = uprn.match(staticPattern);
    
    if (staticMatch) {
      return {
        type: 'static',
        userFragment: staticMatch[1],
        hash: staticMatch[2]
      };
    }
    
    return null;
  }
  
  const prefix = match[1];
  const userFragment = match[2];
  const timestamp = match[3];
  const randomFragment = match[4];
  const escrowFragment = match[5] || null;
  
  // Map prefix to transaction type
  const typeMap = {
    'TRF': 'transfer',
    'DEP': 'deposit',
    'WDR': 'withdrawal',
    'ESR': 'escrow_release',
    'ESF': 'escrow_refund',
    'PAY': 'payment'
  };
  
  return {
    type: 'transaction',
    transactionType: typeMap[prefix] || 'unknown',
    userFragment,
    timestamp: new Date(parseInt(timestamp)),
    randomFragment,
    escrowFragment,
    isEscrowTransfer: prefix === 'ESR' || prefix === 'ESF'
  };
};

/**
 * Validate that a name matches between different sources
 * Used to verify bank account names match registered user names
 * 
 * @param {string} registeredName - Name registered in the app
 * @param {string} bankName - Name from bank account or card
 * @returns {boolean} - Whether names match after normalization
 */
exports.validateNameMatch = (registeredName, bankName) => {
  if (!registeredName || !bankName) return false;
  
  // Normalize names by:
  // 1. Convert to uppercase
  // 2. Remove extra spaces
  // 3. Remove special characters
  const normalize = (name) => {
    return name
      .toUpperCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .replace(/[^\w\s]/g, ''); // Remove special characters
  };
  
  const normalizedRegistered = normalize(registeredName);
  const normalizedBank = normalize(bankName);
  
  // Check if bank name is contained within registered name or vice versa
  // This handles cases where one name might have middle names or initials
  return normalizedRegistered.includes(normalizedBank) || 
         normalizedBank.includes(normalizedRegistered) ||
         normalizedRegistered === normalizedBank;
};

/**
 * Find a transaction by UPRN
 * 
 * @param {string} uprn - The UPRN to search for
 * @param {mongoose.Model} TransactionModel - The Transaction model to query
 * @returns {Promise<Object>} - The found transaction or null
 */
exports.findTransactionByUPRN = async (uprn, TransactionModel) => {
  try {
    return await TransactionModel.findOne({ reference: uprn });
  } catch (error) {
    console.error('Error finding transaction by UPRN:', error);
    return null;
  }
};

/**
 * Create a payment verification record
 * This tracks payments using Squad API for instant verification
 * 
 * @param {Object} paymentData - Payment information
 * @param {mongoose.Model} VerificationModel - The verification model to use
 * @returns {Promise<Object>} - The created verification record
 */
exports.createVerificationRecord = async (paymentData, VerificationModel) => {
  try {
    // Create verification record
    const verification = new VerificationModel({
      userId: paymentData.userId,
      paymentMethod: paymentData.paymentMethod || 'squad_api',
      amount: paymentData.amount,
      currency: paymentData.currency,
      uprn: paymentData.uprn,
      // Name verification only needed for non-Squad payments
      nameOnAccount: paymentData.nameOnAccount,
      registeredName: paymentData.registeredName,
      // Squad API payments are pre-verified by the payment processor
      nameVerified: paymentData.paymentMethod === 'squad_api' ? true : false,
      status: paymentData.status || 'pending',
      externalReference: paymentData.externalReference || null,
      squadRef: paymentData.squadRef || null,
      metadata: paymentData.metadata || {}
    });
    
    await verification.save();
    return verification;
  } catch (error) {
    console.error('Error creating verification record:', error);
    throw error;
  }
}; 