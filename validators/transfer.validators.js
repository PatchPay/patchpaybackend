const ACCOUNT_NUMBER_PATTERN = /^\d{10}$/;

const parseAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
};

const validateAccountLookup = (body = {}) => {
  const bankCode = String(body.bankCode || body.bank_code || "").trim();
  const accountNumber = String(body.accountNumber || "").trim();

  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    return { error: "accountNumber must be exactly 10 digits" };
  }

  return {
    value: {
      bankCode,
      accountNumber,
    },
  };
};

const validateInternalTransfer = (body = {}) => {
  const recipientAccount = String(body.recipientAccount || "").trim();
  const amount = parseAmount(body.amount);
  const transactionPin = String(body.transactionPin || "").trim();

  if (!recipientAccount) {
    return { error: "recipientAccount is required" };
  }

  if (!amount) {
    return { error: "amount must be greater than 0" };
  }

  if (!transactionPin) {
    return { error: "transactionPin is required" };
  }

  return {
    value: {
      recipientAccount,
      amount,
      transactionPin,
      description: body.description ? String(body.description).trim() : "",
    },
  };
};

const validateExternalTransfer = (body = {}) => {
  const lookup = validateAccountLookup(body);
  if (lookup.error) return lookup;

  if (!lookup.value.bankCode) {
    return { error: "bankCode is required" };
  }

  const amount = parseAmount(body.amount);
  const transactionPin = String(body.transactionPin || "").trim();

  if (!amount) {
    return { error: "amount must be greater than 0" };
  }

  if (!transactionPin) {
    return { error: "transactionPin is required" };
  }

  return {
    value: {
      ...lookup.value,
      amount,
      transactionPin,
      accountName: body.accountName ? String(body.accountName).trim() : "",
      description: body.description ? String(body.description).trim() : "",
    },
  };
};

module.exports = {
  validateAccountLookup,
  validateInternalTransfer,
  validateExternalTransfer,
};
