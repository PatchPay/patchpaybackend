const axios = require('axios');

// Squad API configuration
const SQUAD_API_URL = process.env.SQUAD_API_BASE_URL || 'https://api-d.squadco.com/v1'; // Use sandbox URL for dev
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;
const SQUAD_PUBLIC_KEY = process.env.SQUAD_PUBLIC_KEY;

// Create axios instance for Squad API calls
const squadApi = axios.create({
  baseURL: SQUAD_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SQUAD_SECRET_KEY}`
  },
  timeout: 30000 // 30 seconds timeout
});

/**
 * Initiates a payment transaction using Squad Direct API
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} - Response from Squad API
 */
exports.initiatePayment = async (paymentData) => {
  try {
    console.log('Initiating payment with Squad:', paymentData);
    
    const payload = {
      amount: paymentData.amount * 100, // Convert to kobo (smallest unit)
      email: paymentData.email,
      currency: paymentData.currency || 'NGN',
      transaction_ref: paymentData.transactionRef,
      callback_url: paymentData.callbackUrl || `${process.env.BACKEND_URL}/api/payments/deposit/callback`,
      customer: {
        name: paymentData.customerName,
        email: paymentData.email,
        phone: paymentData.phone || ''
      },
      meta_data: {
        user_id: paymentData.userId,
        uprn: paymentData.uprn || '',
        purpose: 'Account funding'
      }
    };
    
    const response = await squadApi.post('/transaction/initiate', payload);
    console.log('Payment initiated successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Payment initiation failed:', error);
    
    // Detailed error logging
    if (error.response) {
      console.error(`Squad API error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
};

/**
 * Verifies a transaction using Squad verification endpoint
 * @param {string} transactionRef - Reference of the transaction to verify
 * @returns {Promise<Object>} - Response from Squad API with transaction status
 */
exports.verifyTransaction = async (transactionRef) => {
  try {
    console.log('Verifying transaction:', transactionRef);
    
    const response = await squadApi.get(`/transaction/verify/${transactionRef}`);
    console.log('Transaction verification result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Transaction verification failed:', error);
    
    if (error.response) {
      console.error(`Squad verification error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
};

/**
 * Initiates a bank transfer/withdrawal
 * @param {Object} withdrawalData - Withdrawal details
 * @returns {Promise<Object>} - Response from Squad API
 */
exports.initiateWithdrawal = async (withdrawalData) => {
  try {
    console.log('Initiating withdrawal with Squad:', withdrawalData);
    
    const payload = {
      amount: withdrawalData.amount * 100, // Convert to kobo (smallest unit)
      bank_code: withdrawalData.bankCode,
      account_number: withdrawalData.accountNumber,
      account_name: withdrawalData.accountName,
      currency: withdrawalData.currency || 'NGN',
      transaction_ref: withdrawalData.transactionRef,
      narration: withdrawalData.description || 'Wallet withdrawal',
      meta_data: {
        user_id: withdrawalData.userId,
        uprn: withdrawalData.uprn || '',
        purpose: 'Wallet withdrawal'
      }
    };
    
    const response = await squadApi.post('/transfer', payload);
    console.log('Withdrawal initiated successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Withdrawal initiation failed:', error);
    
    if (error.response) {
      console.error(`Squad API withdrawal error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
};

/**
 * Gets the status of a transfer/withdrawal transaction
 * @param {string} transactionRef - Reference of the transaction to check
 * @returns {Promise<Object>} - Response from Squad API with withdrawal status
 */
exports.getWithdrawalStatus = async (transactionRef) => {
  try {
    console.log('Checking withdrawal status:', transactionRef);
    
    const response = await squadApi.get(`/transfer/get-transfer?transaction_ref=${transactionRef}`);
    console.log('Withdrawal status result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Withdrawal status check failed:', error);
    
    if (error.response) {
      console.error(`Squad API status check error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
};

/**
 * Gets a list of supported banks for transfers
 * @returns {Promise<Object>} - Response from Squad API with list of banks
 */
exports.getBanks = async () => {
  try {
    console.log('Getting list of banks from Squad API');
    
    const response = await squadApi.get('/transfer/bank-codes');
    console.log('Banks list retrieved successfully');
    return response.data;
  } catch (error) {
    console.error('Failed to retrieve banks list:', error);
    
    if (error.response) {
      console.error(`Squad API banks list error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
};

/**
 * Resolves a bank account to get account name
 * @param {string} accountNumber - Account number to resolve
 * @param {string} bankCode - Bank code for the account
 * @returns {Promise<Object>} - Response from Squad API with account details
 */
exports.resolveBankAccount = async (accountNumber, bankCode) => {
  try {
    console.log(`Resolving bank account: ${accountNumber}, bank code: ${bankCode}`);
    
    const response = await squadApi.get(`/transfer/account-lookup?account_no=${accountNumber}&bank_code=${bankCode}`);
    console.log('Bank account resolved successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Bank account resolution failed:', error);
    
    if (error.response) {
      console.error(`Squad API account resolution error - Status: ${error.response.status}`, error.response.data);
    }
    
    throw error;
  }
}; 