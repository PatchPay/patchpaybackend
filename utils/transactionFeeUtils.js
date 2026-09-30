
/**
 * Transaction Fee Utility Functions
 *
 * Handles:
 * - Currency detection
 * - Country/continent detection
 * - Domestic vs international transactions
 * - Squad vs Stripe transaction rates
 * - Transaction fee calculation
 */

const prisma = require("../lib/prisma");

// ============================================================
// COUNTRY → CURRENCY
// ============================================================

const countryCurrencyMap = {
  // Africa
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  ET: "ETB",
  CM: "XAF",
  SN: "XOF",
  CI: "XOF",
  ML: "XOF",
  BF: "XOF",
  NE: "XOF",
  TG: "XOF",
  BJ: "XOF",
  DZ: "DZD",
  MA: "MAD",

  // Europe
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  IE: "EUR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",

  // North America
  US: "USD",
  CA: "CAD",
  MX: "MXN",

  // Asia
  CN: "CNY",
  JP: "JPY",
  IN: "INR",
  SG: "SGD",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  IL: "ILS",
  KR: "KRW",
  TH: "THB",
  MY: "MYR",
  ID: "IDR",
  PK: "PKR",
  PH: "PHP",
  VN: "VND",

  // Oceania
  AU: "AUD",
  NZ: "NZD",

  // South America
  BR: "BRL",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
};

// ============================================================
// COUNTRY → CONTINENT
// ============================================================

const countryContinentMap = {
  // Africa
  NG: "Africa",
  GH: "Africa",
  KE: "Africa",
  ZA: "Africa",
  EG: "Africa",
  UG: "Africa",
  TZ: "Africa",
  RW: "Africa",
  ET: "Africa",
  CM: "Africa",
  SN: "Africa",
  CI: "Africa",
  ML: "Africa",
  BF: "Africa",
  NE: "Africa",
  TG: "Africa",
  BJ: "Africa",
  DZ: "Africa",
  MA: "Africa",

  // Europe
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  IT: "Europe",
  ES: "Europe",
  NL: "Europe",
  BE: "Europe",
  PT: "Europe",
  IE: "Europe",
  CH: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  PL: "Europe",

  // North America
  US: "North America",
  CA: "North America",
  MX: "North America",

  // Asia
  CN: "Asia",
  JP: "Asia",
  IN: "Asia",
  SG: "Asia",
  AE: "Asia",
  SA: "Asia",
  QA: "Asia",
  IL: "Asia",
  KR: "Asia",
  TH: "Asia",
  MY: "Asia",
  ID: "Asia",
  PK: "Asia",
  PH: "Asia",
  VN: "Asia",

  // Oceania
  AU: "Australia",
  NZ: "Australia",

  // South America
  BR: "South America",
  AR: "South America",
  CL: "South America",
  CO: "South America",
  PE: "South America",
};

// ============================================================
// COUNTRY HELPERS
// ============================================================

const normalizeCountryCode = (countryCode) => {
  if (!countryCode || typeof countryCode !== "string") {
    return null;
  }

  return countryCode.trim().toUpperCase();
};

/**
 * Get currency for a country code.
 */
const getCurrencyForCountry = (countryCode) => {
  const normalizedCode = normalizeCountryCode(countryCode);

  if (!normalizedCode) {
    throw new Error("Country code is required");
  }

  const currency = countryCurrencyMap[normalizedCode];

  if (!currency) {
    console.error(
      `No currency mapping found for country code: ${normalizedCode}`
    );

    throw new Error(
      `Cannot determine currency for country code: ${normalizedCode}`
    );
  }

  return currency;
};

/**
 * Get continent for a country code.
 */
const getContinentForCountry = (countryCode) => {
  const normalizedCode = normalizeCountryCode(countryCode);

  if (!normalizedCode) {
    return "Unknown";
  }

  return countryContinentMap[normalizedCode] || "Unknown";
};

/**
 * Determine whether transaction is international.
 *
 * Same country:
 * NG → NG = false
 *
 * Different countries:
 * NG → GH = true
 */
const isInternationalTransaction = (
  senderCountry,
  recipientCountry
) => {
  const sender = normalizeCountryCode(senderCountry);
  const recipient = normalizeCountryCode(recipientCountry);

  return sender !== recipient;
};

/**
 * Determine whether transaction crosses continents.
 *
 * NG → GH = false
 * NG → GB = true
 */
const isCrossContinentalTransaction = (
  senderCountry,
  recipientCountry
) => {
  const senderContinent = getContinentForCountry(senderCountry);
  const recipientContinent = getContinentForCountry(recipientCountry);

  if (
    senderContinent === "Unknown" ||
    recipientContinent === "Unknown"
  ) {
    return false;
  }

  return senderContinent !== recipientContinent;
};

// ============================================================
// PAYMENT PROVIDER
// ============================================================

/**
 * Normalize provider name.
 *
 * Accepts:
 * - Squad
 * - squad
 * - Stripe
 * - stripe
 */
const normalizePaymentProvider = (provider) => {
  if (!provider) {
    return "squad";
  }

  const normalized = String(provider).trim().toLowerCase();

  if (normalized === "squad") {
    return "squad";
  }

  if (normalized === "stripe") {
    return "stripe";
  }

  throw new Error(
    `Unsupported payment provider: ${provider}. Expected Squad or Stripe.`
  );
};

/**
 * Determine payment gateway.
 *
 * This keeps your existing gateway behavior:
 *
 * Africa → Africa = GTB
 * Everything else = Switch
 *
 * NOTE:
 * This is separate from the RATE provider.
 * The rate provider is Squad or Stripe.
 */
const determinePaymentGateway = (
  senderCountry,
  recipientCountry
) => {
  const senderContinent = getContinentForCountry(senderCountry);
  const recipientContinent = getContinentForCountry(recipientCountry);

  if (
    senderContinent === "Africa" &&
    recipientContinent === "Africa"
  ) {
    return "GTB";
  }

  return "Switch";
};

// ============================================================
// RATE SELECTION
// ============================================================

/**
 * Select the correct database field from the Rate model.
 *
 * Your current Rate model contains ONLY:
 *
 * rate_international_squad
 * rate_international_stripe
 * rate_national_squad
 * rate_national_stripe
 */
const getRateField = ({
  isInternational,
  paymentProvider,
}) => {
  if (isInternational) {
    return paymentProvider === "stripe"
      ? "rate_international_stripe"
      : "rate_international_squad";
  }

  return paymentProvider === "stripe"
    ? "rate_national_stripe"
    : "rate_national_squad";
};

// ============================================================
// GET ACTIVE RATE
// ============================================================

/**
 * Get the configured rate from the database.
 *
 * Since the current Rate model does NOT have:
 * - userType
 * - isActive
 *
 * we simply retrieve the configured rate.
 *
 * If you eventually want multiple rate configurations,
 * we can add a status/type field later.
 */
const getTransactionRate = async ({
  isInternational,
  paymentProvider,
}) => {
  const rateField = getRateField({
    isInternational,
    paymentProvider,
  });

  const rate = await prisma.rate.findFirst({
    orderBy: {
      id: "desc",
    },
  });

  if (!rate) {
    throw new Error(
      "No transaction rate configuration found"
    );
  }

  const rateValue = rate[rateField];

  if (
    typeof rateValue !== "number" ||
    !Number.isFinite(rateValue) ||
    rateValue < 0
  ) {
    throw new Error(
      `Invalid configured transaction rate: ${rateField}`
    );
  }

  return {
    rate,
    rateField,
    rateValue,
  };
};

// ============================================================
// TRANSACTION FEE CALCULATION
// ============================================================

/**
 * Calculate transaction fee.
 *
 * @param {Object} senderUser
 * @param {Object} recipientUser
 * @param {number} amount
 * @param {string} paymentProvider - "squad" or "stripe"
 * @param {Object|null} transactionLimits
 *
 * Example:
 *
 * calculateTransactionFee(
 *   senderUser,
 *   recipientUser,
 *   100000,
 *   "squad"
 * );
 */
const calculateTransactionFee = async (
  senderUser,
  recipientUser,
  amount,
  paymentProvider = "squad",
  transactionLimits = null
) => {
  if (!senderUser) {
    throw new Error("Sender user is required");
  }

  if (!recipientUser) {
    throw new Error("Recipient user is required");
  }

  if (
    amount === null ||
    amount === undefined ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) < 0
  ) {
    throw new Error("Invalid transaction amount");
  }

  amount = Number(amount);

  const provider = normalizePaymentProvider(paymentProvider);

  const senderCountry = normalizeCountryCode(
    senderUser.countryCode || "NG"
  );

  const recipientCountry = normalizeCountryCode(
    recipientUser.countryCode || "NG"
  );

  const isInternational = isInternationalTransaction(
    senderCountry,
    recipientCountry
  );

  const isCrossContinental = isCrossContinentalTransaction(
    senderCountry,
    recipientCountry
  );

  const paymentGateway = determinePaymentGateway(
    senderCountry,
    recipientCountry
  );

  // ----------------------------------------------------------
  // Get configured rate
  // ----------------------------------------------------------

  const {
    rate,
    rateField,
    rateValue,
  } = await getTransactionRate({
    isInternational,
    paymentProvider: provider,
  });

  // ----------------------------------------------------------
  // Transaction limits
  // ----------------------------------------------------------

  let applyFee = true;

  let feeDescription = isInternational
    ? "International transaction fee"
    : "Domestic transaction fee";

  /**
   * Transaction limits are still supported if your
   * transaction code passes them in.
   *
   * International transactions always pay the configured
   * international rate.
   */
  if (transactionLimits && !isInternational) {
    if (
      transactionLimits.type === "unlimited_until_date" &&
      transactionLimits.endDate &&
      new Date() < new Date(transactionLimits.endDate)
    ) {
      applyFee = false;

      feeDescription =
        "Fee waived - Unlimited transactions until " +
        new Date(
          transactionLimits.endDate
        ).toLocaleDateString();
    }

    if (
      transactionLimits.type === "unlimited_until_amount" &&
      Number(transactionLimits.currentAmount) <
        Number(transactionLimits.maxAmount)
    ) {
      applyFee = false;

      feeDescription =
        `Fee waived - Unlimited transactions until ${transactionLimits.maxAmount} is reached`;
    }
  }

  // International transactions always use their configured rate.
  if (isInternational) {
    applyFee = true;

    if (isCrossContinental) {
      feeDescription = "Cross-continental transaction fee";
    } else {
      feeDescription =
        "International transaction fee (same continent)";
    }
  }

  // ----------------------------------------------------------
  // Calculate fee
  // ----------------------------------------------------------

  const feePercentage = rateValue;

  const flatFee = 0;

  const feeAmount = applyFee
    ? amount * (feePercentage / 100) + flatFee
    : 0;

  // ----------------------------------------------------------
  // Return transaction fee information
  // ----------------------------------------------------------

  return {
    feeAmount,
    feePercentage,
    flatFee,

    paymentProvider: provider,

    paymentGateway,

    feeDescription,

    rateId: rate.id,

    rateField,

    rateSnapshot: rate,

    isInternational,

    isCrossContinental,

    senderCountry,

    recipientCountry,

    senderCurrency: getCurrencyForCountry(senderCountry),

    recipientCurrency: getCurrencyForCountry(
      recipientCountry
    ),

    feeApplied: applyFee,
  };
};

// ============================================================
// USER CURRENCY
// ============================================================

/**
 * Get currency for a user based on their country.
 */
const getCurrencyForUser = (user) => {
  if (!user) {
    throw new Error(
      "Cannot determine currency: User data not provided"
    );
  }

  const countryCode = normalizeCountryCode(
    user.countryCode
  );

  if (countryCode) {
    const currency = countryCurrencyMap[countryCode];

    if (currency) {
      return currency;
    }
  }

  // Fallback for users where countryCode is unavailable.
  if (user.country) {
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

    const countryCode =
      countryNameToCode[user.country];

    if (countryCode) {
      const currency =
        countryCurrencyMap[countryCode];

      if (currency) {
        return currency;
      }
    }
  }

  throw new Error(
    `Cannot determine currency: User has invalid or missing country data. Country: ${
      user.country || "Not set"
    }, CountryCode: ${
      user.countryCode || "Not set"
    }`
  );
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  calculateTransactionFee,
  getCurrencyForUser,
  getCurrencyForCountry,
  getContinentForCountry,
  isInternationalTransaction,
  isCrossContinentalTransaction,
  determinePaymentGateway,
  getTransactionRate,
};

