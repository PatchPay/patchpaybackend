const axios = require("axios");

const BASE_URL =
  process.env.SQUAD_API_BASE_URL || "https://sandbox-api-d.squadco.com";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: Number(process.env.SQUAD_TIMEOUT_MS || 30000),
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  if (!process.env.SQUAD_SECRET_KEY) {
    throw new Error("SQUAD_SECRET_KEY is not configured");
  }

  config.headers.Authorization = `Bearer ${process.env.SQUAD_SECRET_KEY}`;
  return config;
});

const normalizeError = (error) => {
  const response = error.response?.data;
  const message =
    response?.message ||
    response?.error ||
    error.message ||
    "SquadCo request failed";

  const normalized = new Error(message);
  normalized.statusCode = error.response?.status || 502;
  normalized.code = error.code;
  normalized.providerResponse = response;
  normalized.retryable =
    !error.response ||
    ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET"].includes(error.code) ||
    error.response.status >= 500 ||
    error.response.status === 429;

  return normalized;
};

const request = async (method, url, data, config = {}) => {
  try {
    const response = await client.request({ method, url, data, ...config });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
};

const normalizePayoutStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["successful", "success", "completed"].includes(value)) return "success";
  if (["failed", "failure", "declined", "rejected"].includes(value)) return "failed";
  if (["reversed", "reverse"].includes(value)) return "reversed";
  if (["pending", "processing", "pending_requery"].includes(value)) {
    return "processing";
  }
  return "processing";
};

const normalizeCollectionStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["successful", "success", "completed", "approved"].includes(value)) {
    return "success";
  }
  if (["failed", "failure", "declined", "rejected"].includes(value)) {
    return "failed";
  }
  return "pending";
};

const initiateCollection = async ({
  amount,
  email,
  currency = "NGN",
  transactionRef,
  callbackUrl,
  metadata = {},
}) => {
  const response = await request("post", "/transaction/initiate", {
    amount: Number(amount) * 100,
    email,
    currency,
    initiate_type: "inline",
    transaction_ref: transactionRef,
    callback_url: callbackUrl,
    metadata,
  });

  return {
    raw: response,
    checkoutUrl: response?.data?.checkout_url,
    transactionRef,
  };
};

const verifyCollection = async (transactionRef) => {
  const response = await request("get", `/transaction/verify/${transactionRef}`);
  const data = response?.data || {};

  return {
    raw: response,
    status: normalizeCollectionStatus(data.status),
    amount:
      data.amount ||
      data.transaction_amount ||
      data.charged_amount ||
      data.principal_amount,
    currency: data.currency || "NGN",
    transactionRef:
      data.transaction_ref ||
      data.transaction_reference ||
      data.reference ||
      transactionRef,
    providerReference:
      data.gateway_ref ||
      data.gateway_reference ||
      data.transaction_ref ||
      data.reference ||
      null,
  };
};

const lookupAccount = async ({ bankCode, accountNumber }) => {
  const response = await request("post", "/payout/account/lookup", {
    bank_code: bankCode,
    account_number: accountNumber,
  });

  const data = response?.data || {};
  const accountName =
    data.account_name ||
    data.accountName ||
    data.account_name_enquiry ||
    "";

  if (!accountName) {
    const error = new Error("Invalid bank account");
    error.statusCode = 400;
    error.providerResponse = response;
    throw error;
  }

  return {
    accountName,
    bankCode,
    accountNumber,
    verified: true,
    raw: response,
  };
};

const initiatePayout = async ({
  amount,
  bankCode,
  accountNumber,
  accountName,
  transactionRef,
  description,
}) => {
  const response = await request("post", "/payout/transfer", {
    amount: String(amount),
    bank_code: bankCode,
    account_number: accountNumber,
    account_name: accountName,
    currency_id: "NGN",
    transaction_reference: transactionRef,
    remark: description || "Wallet withdrawal",
  });

  const data = response?.data || {};
  return {
    raw: response,
    status: normalizePayoutStatus(data.status || response.status),
    providerReference:
      data.nip_transaction_reference ||
      data.transaction_reference ||
      data.reference ||
      null,
  };
};

const requeryPayout = async (transactionRef) => {
  const response = await request("post", "/payout/requery", {
    transaction_reference: transactionRef,
  });

  const data = response?.data || {};
  return {
    raw: response,
    status: normalizePayoutStatus(data.status || response.status),
    providerReference:
      data.nip_transaction_reference ||
      data.transaction_reference ||
      data.reference ||
      null,
  };
};

const getBanks = async () => {
  return request("post", "/transaction/mandate/banklists");
};

module.exports = {
  getBanks,
  initiateCollection,
  initiatePayout,
  lookupAccount,
  normalizeCollectionStatus,
  normalizePayoutStatus,
  requeryPayout,
  verifyCollection,
};
