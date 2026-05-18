const axios = require("axios");

const BASE_URL =
  process.env.SQUAD_API_BASE_URL || "https://sandbox-api-d.squadco.com";

const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;

// ========================
// AXIOS INSTANCE (PRIVATE)
// ========================
const squadClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SQUAD_SECRET_KEY}`,
  },
  timeout: 30000,
});
/**
 * INITIATE PAYMENT
 */
exports.initiatePayment = async (paymentData) => {
  try {
    const payload = {
      amount: paymentData.amount * 100,
      email: paymentData.email,
      currency: paymentData.currency || "NGN",
      transaction_ref: paymentData.transactionRef,
      callback_url:
        paymentData.callbackUrl ||
        `${process.env.BACKEND_URL}/api/payments/deposit/webhook`,
      customer: {
        name: paymentData.customerName,
        email: paymentData.email,
        phone: paymentData.phone || "",
      },
    };

    const res = await squadApi.post("/transaction/initiate", payload);
    return res.data;
  } catch (err) {
    console.error(err.response?.data || err.message);
    throw err;
  }
};

/**
 * LOOKUP ACCOUNT (FIXED)
 */
exports.lookupAccount = async ({ bankCode, accountNumber }) => {
  const payload = {
    bank_code: bankCode,
    account_number: accountNumber,
  };

  const res = await squadClient.post("/payout/account/lookup", payload);

  return res.data;
};

/**
 * INITIATE WITHDRAWAL (🔥 FIXED)
 */
exports.initiateWithdrawal = async (withdrawalData) => {
  try {
    // ✅ MAP EVERYTHING TO SQUAD FORMAT HERE (IMPORTANT)
    const payload = {
      amount: String(withdrawalData.amount),

      bank_code: withdrawalData.bankCode,

      account_number: withdrawalData.accountNumber,

      account_name: withdrawalData.accountName,

      currency_id: "NGN",

      transaction_reference: withdrawalData.transactionRef,

      remark: withdrawalData.description || "Wallet withdrawal",
    };

    console.log("🔥 FINAL SQUAD PAYLOAD:", payload);

    const response = await squadApi.post("/payout/transfer", payload);

    console.log("✅ SQUAD RESPONSE:", response.data);

    return response.data;
  } catch (error) {
    console.log("❌ SQUAD ERROR:", error.response?.data);

    throw error;
  }
};

/**
 * REQUERY TRANSFER
 */
exports.requeryTransfer = async (ref) => {
  try {
    const res = await squadApi.post("/payout/requery", {
      transaction_reference: ref,
    });

    return res.data;
  } catch (err) {
    throw err;
  }
};

/**
 * GET BANK LIST (FIXED)
 */
exports.getBanks = async () => {
  try {
    const res = await squadApi.post("/transaction/mandate/banklists");
    return res.data;
  } catch (err) {
    const payload =
      err.response?.data || err.message || "Unknown Squad bank list error";
    console.error("Squad bank list error:", payload);
    throw new Error(payload);
  }
};

/**
 * RESOLVE ACCOUNT (FIXED)
 */
exports.resolveAccount = async (req, res) => {
  try {
    // ✅ Accept both camelCase (from app) and snake_case (legacy)
    const accountNumber = req.body.accountNumber || req.body.account_number;
    const bankCode = req.body.bankCode || req.body.bank_code;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: "accountNumber and bankCode are required",
      });
    }

    const squadRes = await squadApi.lookupAccount({ accountNumber, bankCode });

    // Squad returns: { status: 200, success: true, data: { account_name, account_number } }
    return res.status(200).json({
      success: true,
      data: {
        accountName: squadRes.data?.account_name,
        accountNumber: squadRes.data?.account_number,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Error resolving bank account:", error);
    return res.status(500).json({
      success: false,
      message:
        error?.response?.data?.message ||
        error.message ||
        "Failed to resolve bank account",
    });
  }
};

/**
 * VERIFY STATUS
 */
exports.getWithdrawalStatus = async (ref) => {
  try {
    const res = await squadApi.get(
      `/payout/transfer?transaction_reference=${ref}`,
    );

    return res.data;
  } catch (err) {
    throw err;
  }
};
