const bankService = require("../services/bankService");
const transferService = require("../services/transfer.service");
const {
  validateAccountLookup,
  validateExternalTransfer,
  validateInternalTransfer,
} = require("../validators/transfer.validators");

const getIdempotencyKey = (req) =>
  req.headers["idempotency-key"] ||
  req.headers["x-idempotency-key"] ||
  req.body.idempotencyKey;

const sendError = (res, error) => {
  const statusCode = error.statusCode || error.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: error.message || "Request failed",
  });
};

const accountLookup = async (req, res) => {
  const validation = validateAccountLookup(req.body);
  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error,
    });
  }

  try {
    const result = await transferService.accountLookup(validation.value);
    return res.status(200).json({
      success: true,
      data: {
        accountName: result.accountName,
        bankCode: result.bankCode,
        accountNumber: result.accountNumber,
        verified: true,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const internalTransfer = async (req, res) => {
  const validation = validateInternalTransfer(req.body);
  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error,
    });
  }

  try {
    const result = await transferService.internalTransfer({
      user: req.user,
      ...validation.value,
      idempotencyKey: getIdempotencyKey(req),
    });

    return res.status(result.repeated ? 200 : 201).json({
      success: true,
      repeated: result.repeated,
      data: {
        transaction: {
          id: result.transaction._id,
          reference: result.transaction.reference,
          amount: result.transaction.amount,
          fee: result.transaction.fee,
          total: result.transaction.total,
          currency: result.transaction.currency,
          status: result.transaction.status,
        },
        senderBalance: result.senderBalance,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const externalBankTransfer = async (req, res) => {
  const validation = validateExternalTransfer(req.body);
  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: validation.error,
    });
  }

  try {
    const result = await transferService.externalBankTransfer({
      user: req.user,
      ...validation.value,
      idempotencyKey: getIdempotencyKey(req),
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      flowType: req.body.flowType || "external_bank_transfer",
    });

    return res.status(result.repeated ? 200 : 201).json({
      success: true,
      repeated: result.repeated,
      retryRequired: result.retryRequired || false,
      data: {
        transfer: {
          id: result.withdrawal._id,
          transactionRef: result.withdrawal.transactionRef,
          providerReference: result.withdrawal.squadRef,
          amount: result.withdrawal.amount,
          currency: result.withdrawal.currency,
          status: result.withdrawal.status,
        },
        transaction: result.transaction
          ? {
              id: result.transaction._id,
              reference: result.transaction.reference,
              amount: result.transaction.amount,
              currency: result.transaction.currency,
              status: result.transaction.status,
            }
          : null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const withdrawal = async (req, res) => {
  req.body.flowType = "withdrawal";
  return externalBankTransfer(req, res);
};

const verifyExternalTransfer = async (req, res) => {
  const transactionRef = String(req.body.transactionRef || "").trim();
  if (!transactionRef) {
    return res.status(400).json({
      success: false,
      message: "transactionRef is required",
    });
  }

  try {
    const result = await transferService.verifyExternalTransferStatus(transactionRef);
    return res.status(200).json({
      success: true,
      data: {
        transfer: result.withdrawal,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getBanks = async (req, res) => {
  try {
    const banks = await bankService.getBanks({
      forceRefresh: req.query.force === "true",
    });

    return res.status(200).json({
      success: true,
      data: {
        banks: banks.map((bank) => ({
          code: bank.bankCode,
          name: bank.name,
          active: bank.active,
        })),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  accountLookup,
  externalBankTransfer,
  getBanks,
  internalTransfer,
  verifyExternalTransfer,
  withdrawal,
};
