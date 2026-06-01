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



  // Create Squad payment session
    const squadApiUrl =
      process.env.SQUAD_API_BASE_URL || "https://sandbox-api-d.squadco.com";
    const squadSecretKey = process.env.SQUAD_SECRET_KEY;

    console.log("FINAL URL:", `${squadApiUrl}/transaction/initiate`);

    console.log("SQUAD SECRET KEY:", squadSecretKey);
    console.log("SQUAD API URL:", squadApiUrl);

    console.log("KEY BEING SENT:", squadSecretKey);

    if (!squadSecretKey) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway configuration error",
      });
    }

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:8081"}/api/payments/transfer/callback`;

    const payload = {
      amount: Number(amount) * 100, // Amount in kobo
      email: user.email,
      currency: "NGN",
      initiate_type: "inline",
      transaction_ref: transactionRef,
      callback_url: callbackUrl,
      // customer: {
      //   name: `${user.firstName} ${user.surname || ""}`,
      //   email: user.email,
      //   phone: user.phoneNumber,
      // },
      metadata: {
        userId: user._id.toString(),
        paymentType: "transfer",
      },
    };

    try {
      const response = await axios.post(
        `${squadApiUrl}/transaction/initiate`,

        payload,

        {
          headers: {
            Authorization: `Bearer ${squadSecretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data && response.data.status === 200) {
        // Update payment with checkout URL
        payment.gatewayResponse = response.data;
        await payment.save();

        return res.status(200).json({
          success: true,
          message: "transfer initiated successfully",
          data: {
            checkoutUrl: response.data.data.checkout_url,
            transactionRef,
            amount,
          },
        });
      } else {
        // Payment failed to initialize
        payment.status = "failed";
        payment.errorMessage = "Failed to initialize payment with gateway";
        payment.gatewayResponse = response.data;
        await payment.save();

        return res.status(400).json({
          success: false,
          message: "Failed to initialize payment",
          error: response.data.message || "Payment gateway error",
        });
      }
    } catch (error) {
      console.log("FULL ERROR:", error.response?.data);
      console.log("STATUS:", error.response?.status);
      console.log(error.response?.status);
      console.log(error.response?.data);

      payment.status = "failed";
      await payment.save();

      return res.status(500).json({
        success: false,
        message: "Payment gateway error",
        error: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error("transfer initiation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
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
