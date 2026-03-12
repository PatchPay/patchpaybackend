/**
 * Utility functions for account management
 */

/**
 * Generate a random account number with a specific pattern
 * Format: 10-digit number starting with country code and account type indicator
 * 
 * @param {string} countryCode - 2-digit country code (e.g., GB for UK, US for United States)
 * @param {string} accountType - Type of account (personal, merchant, ngo, government)
 * @returns {string} - Formatted account number
 * @throws {Error} - If country code or account type is not provided or invalid
 */
exports.generateAccountNumber = (countryCode, accountType = 'personal') => {
  if (!countryCode) {
    throw new Error('Country code is required to generate account number');
  }
  
  if (countryCode.length !== 2) {
    throw new Error('Country code must be a 2-letter code (e.g., GB, US, NG)');
  }

  if (!accountType) {
    throw new Error('Account type is required to generate account number');
  }

  // Map country codes to numeric prefixes for account numbers based on international dialing codes
  const countryPrefixes = {
    'NG': '234', // Nigeria
    'GB': '440', // United Kingdom
    'US': '100', // United States
    'DE': '490', // Germany
    'FR': '330', // France
    'CA': '110', // Canada
    'ZA': '270', // South Africa
    'AU': '610', // Australia
    'IN': '910', // India
    'JP': '810', // Japan
    'KE': '254', // Kenya
    'GH': '233', // Ghana
    'ES': '340', // Spain
    'IT': '390', // Italy
    'MX': '520'  // Mexico
    // Add more countries as needed
  };
  
  // Account type prefix - single digit for account type
  const accountTypePrefixes = {
    'personal': '1',
    'merchant': '2',
    'ngo': '3',
    'government': '4'
  };
  
  // Get account type prefix
  const accountTypePrefix = accountTypePrefixes[accountType.toLowerCase()] || '0';
  
  // Use the country-specific prefix or generate a dynamic one based on the country code
  let countryPrefix = countryPrefixes[countryCode];
  if (!countryPrefix) {
    console.log(`No predefined prefix for country code ${countryCode}, generating dynamically`);
    // For countries not in the map, convert the country code to a number
    // by getting ASCII values of the letters
    countryPrefix = (countryCode.charCodeAt(0) * 10 + countryCode.charCodeAt(1)).toString();
    // Ensure it's 3 digits
    countryPrefix = countryPrefix.substring(0, 3).padStart(3, '1');
    console.log(`Dynamically generated prefix for ${countryCode}: ${countryPrefix}`);
  }
  
  // Generate 6 random digits (reduced by 1 to accommodate account type digit)
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  
  // Combine to create a 10-digit account number: 3 for country code + 1 for account type + 6 random digits
  const accountNumber = `${countryPrefix}${accountTypePrefix}${randomDigits}`;
  console.log(`Generated account number for country ${countryCode} and account type ${accountType}: ${accountNumber}`);
  
  return accountNumber;
};

/**
 * Generate a unique transaction reference
 * Format: TR-{TIMESTAMP}-{RANDOM}
 * 
 * @returns {string} - Unique transaction reference
 */
exports.generateTransactionReference = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  return `TR-${timestamp}-${random}`;
};

/**
 * Format currency with proper decimal places and symbol
 * 
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (NGN, USD, etc.)
 * @returns {string} - Formatted amount with currency symbol
 * @throws {Error} - If currency is not provided
 */
exports.formatCurrency = (amount, currency) => {
  if (!currency) {
    throw new Error('Currency code is required to format amount');
  }

  // Map of currency codes to symbols
  const currencySymbols = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  
  // Get symbol, throw error if currency not recognized
  const symbol = currencySymbols[currency];
  if (!symbol) {
    throw new Error(`Unknown currency code: ${currency}`);
  }
  
  // Format with 2 decimal places
  return `${symbol}${parseFloat(amount).toFixed(2)}`;
};

/**
 * Format amount for display (alias of formatCurrency)
 * 
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (NGN, USD, etc.)
 * @returns {string} - Formatted amount with currency symbol
 */
exports.formatAmount = exports.formatCurrency; 