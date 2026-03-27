/**
 * Transaction Fee Utility Functions
 * Handles fee calculations based on user type, country, and continent
 */

// Transaction rate card per customer type
const transactionRates = {
  Personal: {
    baseRate: 1.5,
    countryRate: 0,
    continentRate: 3,
    multiContinentRate: 5,
  },
  Business: {
    baseRate: 1.5,
    countryRate: 10,
    continentRate: 8,
    multiContinentRate: 10,
  },
  NGO: {
    baseRate: 1.5,
    countryRate: 10,
    continentRate: 6,
    multiContinentRate: 6,
  },
  Government: {
    baseRate: 1.5,
    countryRate: 5,
    continentRate: 10,
    multiContinentRate: 15,
  },
};

// Map country codes to currencies
const countryCurrencyMap = {
  // 🌍 Africa
  NG: "NGN", // Nigeria
  GH: "GHS", // Ghana
  KE: "KES", // Kenya
  ZA: "ZAR", // South Africa
  EG: "EGP", // Egypt
  UG: "UGX", // Uganda
  TZ: "TZS", // Tanzania
  RW: "RWF", // Rwanda
  ET: "ETB", // Ethiopia
  CM: "XAF", // Central African CFA
  SN: "XOF", // West African CFA
  CI: "XOF", // Ivory Coast
  ML: "XOF", // Mali
  BF: "XOF", // Burkina Faso
  NE: "XOF", // Niger
  TG: "XOF", // Togo
  BJ: "XOF", // Benin
  DZ: "DZD", // Algeria
  MA: "MAD", // Morocco

  // 🌍 Europe
  GB: "GBP", // United Kingdom
  DE: "EUR", // Germany
  FR: "EUR", // France
  IT: "EUR", // Italy
  ES: "EUR", // Spain
  NL: "EUR", // Netherlands
  BE: "EUR", // Belgium
  PT: "EUR", // Portugal
  IE: "EUR", // Ireland
  CH: "CHF", // Switzerland
  SE: "SEK", // Sweden
  NO: "NOK", // Norway
  DK: "DKK", // Denmark
  PL: "PLN", // Poland

  // 🌎 North America
  US: "USD", // United States
  CA: "CAD", // Canada
  MX: "MXN", // Mexico

  // 🌏 Asia
  CN: "CNY", // China
  JP: "JPY", // Japan
  IN: "INR", // India
  SG: "SGD", // Singapore
  AE: "AED", // UAE
  SA: "SAR", // Saudi Arabia
  QA: "QAR", // Qatar
  IL: "ILS", // Israel
  KR: "KRW", // South Korea
  TH: "THB", // Thailand
  MY: "MYR", // Malaysia
  ID: "IDR", // Indonesia
  PK: "PKR", // Pakistan
  PH: "PHP", // Philippines
  VN: "VND", // Vietnam

  // 🌏 Oceania
  AU: "AUD", // Australia
  NZ: "NZD", // New Zealand

  // 🌎 South America
  BR: "BRL", // Brazil
  AR: "ARS", // Argentina
  CL: "CLP", // Chile
  CO: "COP", // Colombia
  PE: "PEN", // Peru
};

// Map countries to continents
const countryContinentMap = {
  // Africa
  NG: "Africa",
  GH: "Africa",
  KE: "Africa",
  ZA: "Africa",
  EG: "Africa",

  // Europe
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  IT: "Europe",
  ES: "Europe",

  // North America
  US: "North America",
  CA: "North America",
  MX: "North America",

  // Asia
  CN: "Asia",
  JP: "Asia",
  IN: "Asia",
  SG: "Asia",

  // Australia/Oceania
  AU: "Australia",
  NZ: "Australia",

  // South America
  BR: "South America",
  AR: "South America",
  CL: "South America",
};

/**
 * Get the appropriate currency for a country
 * @param {string} countryCode - ISO country code
 * @returns {string} Currency code
 * @throws {Error} If currency cannot be determined for the country code
 */
const getCurrencyForCountry = (countryCode) => {
  const currency = countryCurrencyMap[countryCode];
  if (!currency) {
    console.error(`No currency mapping found for country code: ${countryCode}`);
    throw new Error(
      `Cannot determine currency for country code: ${countryCode}`,
    );
  }
  return currency;
};

/**
 * Get the continent for a country
 * @param {string} countryCode - ISO country code
 * @returns {string} Continent name
 */
const getContinentForCountry = (countryCode) => {
  return countryContinentMap[countryCode] || "Unknown";
};

/**
 * Determine if a transaction is international
 * @param {string} senderCountry - Sender's country code
 * @param {string} recipientCountry - Recipient's country code
 * @returns {boolean} True if international transaction
 */
const isInternationalTransaction = (senderCountry, recipientCountry) => {
  return senderCountry !== recipientCountry;
};

/**
 * Determine if a transaction is cross-continental
 * @param {string} senderCountry - Sender's country code
 * @param {string} recipientCountry - Recipient's country code
 * @returns {boolean} True if cross-continental transaction
 */
const isCrossContinentalTransaction = (senderCountry, recipientCountry) => {
  const senderContinent = getContinentForCountry(senderCountry);
  const recipientContinent = getContinentForCountry(recipientCountry);
  return senderContinent !== recipientContinent;
};

/**
 * Determine which payment gateway to use
 * @param {string} senderCountry - Sender's country code
 * @param {string} recipientCountry - Recipient's country code
 * @returns {string} Payment gateway to use ('GTB' or 'Switch')
 */
const determinePaymentGateway = (senderCountry, recipientCountry) => {
  const senderContinent = getContinentForCountry(senderCountry);
  const recipientContinent = getContinentForCountry(recipientCountry);

  // If both countries are in Africa, use GTB
  if (senderContinent === "Africa" && recipientContinent === "Africa") {
    return "GTB";
  }

  // For all other cases, use Switch
  return "Switch";
};

/**
 * Calculate transaction fee based on user types, countries, and transaction amount
 * @param {Object} senderUser - Sender user object
 * @param {Object} recipientUser - Recipient user object
 * @param {number} amount - Transaction amount
 * @param {Object} transactionLimits - Optional transaction limits object
 * @returns {Object} Transaction fee details
 */
const calculateTransactionFee = (
  senderUser,
  recipientUser,
  amount,
  transactionLimits = null,
) => {
  const senderType = senderUser.accountType || "Personal";
  const senderCountry = senderUser.countryCode || "NG";
  const recipientCountry = recipientUser.countryCode || "NG";

  // Get rate information for sender type
  const rates = transactionRates[senderType] || transactionRates.Personal;

  // Initialize fee variables
  let feePercentage = rates.baseRate;
  let flatFee = 0;
  let paymentGateway = "GTB";
  let feeDescription = "Base transaction fee";

  // Check if transaction is within unlimited transaction period or amount
  let applyFee = true;
  if (transactionLimits) {
    if (
      transactionLimits.type === "unlimited_until_date" &&
      new Date() < new Date(transactionLimits.endDate) &&
      !isInternationalTransaction(senderCountry, recipientCountry)
    ) {
      applyFee = false;
      feeDescription =
        "Fee waived - Unlimited transactions until " +
        new Date(transactionLimits.endDate).toLocaleDateString();
    } else if (
      transactionLimits.type === "unlimited_until_amount" &&
      transactionLimits.currentAmount < transactionLimits.maxAmount &&
      !isInternationalTransaction(senderCountry, recipientCountry)
    ) {
      applyFee = false;
      feeDescription = `Fee waived - Unlimited transactions until ${transactionLimits.maxAmount} is reached`;
    }
  }

  // For international transactions, always apply fees
  if (isInternationalTransaction(senderCountry, recipientCountry)) {
    applyFee = true;

    // Determine the type of international transaction
    if (isCrossContinentalTransaction(senderCountry, recipientCountry)) {
      // Cross-continental transaction
      feePercentage = rates.multiContinentRate;
      feeDescription = "Cross-continental transaction fee";
    } else {
      // Same continent but different countries
      feePercentage = rates.continentRate;
      feeDescription = "International transaction fee (same continent)";
    }

    // Determine payment gateway
    paymentGateway = determinePaymentGateway(senderCountry, recipientCountry);
  } else {
    // Domestic transaction
    if (applyFee) {
      flatFee = rates.countryRate;
      feeDescription = "Domestic transaction fee";
    }
  }

  // Calculate the fee amount
  const feeAmount = applyFee ? amount * (feePercentage / 100) + flatFee : 0;

  return {
    feeAmount,
    feePercentage,
    flatFee,
    paymentGateway,
    feeDescription,
    isInternational: isInternationalTransaction(
      senderCountry,
      recipientCountry,
    ),
    isCrossContinental: isCrossContinentalTransaction(
      senderCountry,
      recipientCountry,
    ),
  };
};

/**
 * Get the appropriate currency for a user based on their country
 * @param {Object} user - User object with country information
 * @returns {string} Currency code
 * @throws {Error} If currency cannot be determined
 */
const getCurrencyForUser = (user) => {
  if (!user) {
    throw new Error("Cannot determine currency: User data not provided");
  }

  console.log("Determining currency for user with data:", {
    countryCode: user.countryCode || "Not set",
    country: user.country || "Not set",
    continent: user.continent || "Not set",
  });

  // PRIORITY HANDLING: For United Kingdom users, immediately return GBP
  if (user.country === "United Kingdom" || user.countryCode === "GB") {
    console.log("UK DETECTED: Setting currency to GBP");
    return "GBP";
  }

  // First try to get currency from countryCode (2-letter code)
  if (user.countryCode) {
    const currencyFromCode = countryCurrencyMap[user.countryCode];
    if (currencyFromCode) {
      console.log(
        `Determined currency ${currencyFromCode} from countryCode ${user.countryCode}`,
      );
      return currencyFromCode;
    } else {
      console.warn(
        `CountryCode ${user.countryCode} did not map to a known currency`,
      );
    }
  }

  // If countryCode doesn't yield a valid currency, try using the country name
  if (user.country) {
    // Map full country names to their respective ISO codes
    const countryNameToCode = {
      "United Kingdom": "GB",
      "United States": "US",
      Nigeria: "NG",
      Ghana: "GH",
      Kenya: "KE",
      "South Africa": "ZA",
      Egypt: "EG",
      Germany: "DE",
      France: "FR",
      Italy: "IT",
      Spain: "ES",
      Canada: "CA",
      Mexico: "MX",
      China: "CN",
      Japan: "JP",
      India: "IN",
      Singapore: "SG",
      Australia: "AU",
      "New Zealand": "NZ",
      Brazil: "BR",
      Argentina: "AR",
      Chile: "CL",
    };

    const countryCode = countryNameToCode[user.country];
    if (countryCode) {
      const currencyFromName = countryCurrencyMap[countryCode];
      if (currencyFromName) {
        console.log(
          `Determined currency ${currencyFromName} from country name ${user.country} (code: ${countryCode})`,
        );
        return currencyFromName;
      } else {
        console.warn(
          `Country name ${user.country} mapped to code ${countryCode}, but no currency found for this code`,
        );
      }
    } else {
      console.warn(
        `Country name ${user.country} did not map to a known country code`,
      );
    }
  }

  // If we cannot determine the currency, throw an error
  const errorMessage = `Cannot determine currency: User has invalid or missing country data. Country: ${user.country || "Not set"}, CountryCode: ${user.countryCode || "Not set"}`;
  console.error(errorMessage);
  throw new Error(errorMessage);
};

module.exports = {
  calculateTransactionFee,
  getCurrencyForUser,
  getCurrencyForCountry,
  getContinentForCountry,
  isInternationalTransaction,
  isCrossContinentalTransaction,
  determinePaymentGateway,
};
