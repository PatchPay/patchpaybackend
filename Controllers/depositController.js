const DepositPayment = require("../models/DepositPayment");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

/**
 * Initiate a deposit payment
 * @route POST /api/payments/deposit/initiate
 */
exports.initiateDeposit = async (req, res) => {
  try {
    // Get user from middleware
    const user = req.user;
    // Get amount from request body
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount",
      });
    }

    // Generate transaction reference
    const transactionRef = `PP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create payment record
    const payment = new DepositPayment({
      userId: user._id,
      amount,
      currency: "NGN",
      transactionRef,
      status: "pending",
    });

    await payment.save();

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

    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:8081"}/api/payments/deposit/callback`;

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
        paymentType: "deposit",
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
          message: "Deposit initiated successfully",
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
    console.error("Deposit initiation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Webhook handler for deposit payment callbacks
 * @route POST /api/payments/deposit/webhook
 */
exports.handleWebhook = async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  try {
    let event;
    if (req.body instanceof Buffer) {
      event = JSON.parse(req.body.toString("utf8"));
    } else {
      event = req.body;
    }

    console.log("EVENT:", event);

    // ✅ Fix: Squad uses "charge_successful" with capital E
    if (event.Event !== "charge_successful") {
      return res.status(200).json({ success: true, message: "Event ignored" });
    }

    // ✅ Fix: TransactionRef is at root level, data is in Body
    const transaction_ref = event.TransactionRef;
    const bodyData = event.Body;

    console.log("Transaction Ref:", transaction_ref);

    // Find the payment
    const payment = await DepositPayment.findOne({
      transactionRef: transaction_ref,
    });

    if (!payment) {
      console.error(
        `Payment not found for transaction ref: ${transaction_ref}`,
      );
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "successful") {
      return res
        .status(200)
        .json({ success: true, message: "Payment already processed" });
    }

    // ✅ Fix: Use bodyData fields
    payment.status = "successful";
    payment.squadRef = bodyData.gateway_ref || "";
    payment.gatewayResponse = event;

    // Find user's wallet
    const wallet = await Wallet.findOne({ userId: payment.userId });

    if (!wallet) {
      payment.errorMessage = "User wallet not found";
      await payment.save();
      return res
        .status(404)
        .json({ success: false, message: "Wallet not found" });
    }

    // Check if transaction already exists
    let transaction = await Transaction.findOne({ reference: transaction_ref });

    if (!transaction) {
      transaction = new Transaction({
        type: "deposit",
        amount: payment.amount,
        currency: payment.currency,
        status: "completed",
        recipientWallet: wallet._id,
        recipientId: payment.userId,
        reference: transaction_ref,
        description: "Deposit via Squad payment gateway",
        externalReference: payment.squadRef,
        isUserAccountTransfer: false, // ✅ deposits are not user account transfers
        paymentMethod: "bank", // ✅ matches your enum
        paymentGateway: "Internal",
        total: payment.amount,
      });

      await transaction.save();

      // Add amount to wallet
      wallet.balance += payment.amount;
      await wallet.save();
    }

    payment.transactionId = transaction._id;
    await payment.save();

    console.log(
      `✅ Deposit successful: ${payment.amount} ${payment.currency} for user ${payment.userId}`,
    );

    return res
      .status(200)
      .json({ success: true, message: "Deposit processed successfully" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing error",
      error: error.message,
    });
  }
};

exports.handleCallback = async (req, res) => {
  const transaction_ref = req.query.transaction_ref || req.query.reference;

  if (!transaction_ref) {
    return res.send(`
      <h2>❌ Invalid Callback</h2>
      <p>No transaction reference found</p>
    `);
  }

  // Return a simple HTML page
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Status</title>
      <style>
        body {
          font-family: Arial;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          flex-direction: column;
        }
        button {
          padding: 10px 20px;
          margin-top: 15px;
          cursor: pointer;
        }
      </style>
    </head>

    <body>
      <h2>⏳ Processing Payment...</h2>
      <p>Transaction Ref: <b>${transaction_ref}</b></p>

      <button onclick="verifyPayment()">Verify Payment</button>

      <p id="result"></p>

      <script>
        async function verifyPayment() {
          const res = await fetch('/api/payments/deposit/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              transactionRef: "${transaction_ref}"
            })
          });

          const data = await res.json();

          const resultEl = document.getElementById("result");

          if (data.success) {
            resultEl.innerHTML = "✅ Payment Successful! Wallet Credited";
          } else {
            resultEl.innerHTML = "❌ Payment Failed: " + data.message;
          }
        }
      </script>
    </body>
    </html>
  `);
};

/**
 * Verify a deposit payment
 * @route POST /api/payments/deposit/verify
 */
exports.verifyDeposit = async (req, res) => {
  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    // Find the payment
    const payment = await DepositPayment.findOne({ transactionRef });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // If payment is already verified
    if (payment.status === "successful") {
      // Get transaction details
      const transaction = payment.transactionId
        ? await Transaction.findById(payment.transactionId)
        : null;

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: {
          payment: {
            id: payment._id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            transactionRef: payment.transactionRef,
            createdAt: payment.createdAt,
          },
          transaction: transaction
            ? {
                id: transaction._id,
                amount: transaction.amount,
                type: transaction.type,
                status: transaction.status,
                reference: transaction.reference,
                createdAt: transaction.createdAt,
              }
            : null,
        },
      });
    }

    // Verify with Squad API
    const squadApiUrl =
      process.env.SQUAD_API_BASE_URL || "https://sandbox-api-d.squadco.com";
    const squadSecretKey = process.env.SQUAD_SECRET_KEY;

    if (!squadSecretKey) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway configuration error",
      });
    }

    try {
      const response = await axios.get(
        `${squadApiUrl}/transaction/verify/${transactionRef}`,
        {
          headers: {
            Authorization: `Bearer ${squadSecretKey}`,
          },
        },
      );

      // Update payment with verification response
      payment.gatewayResponse = response.data;

      if (
        response.data &&
        response.data.status === 200 &&
        response.data.data.status === "success"
      ) {
        // Payment was successful
        payment.status = "successful";
        payment.squadRef = response.data.data.transaction_ref || "";

        // Find user's wallet
        const wallet = await Wallet.findOne({ userId: payment.userId });

        if (!wallet) {
          payment.errorMessage = "User wallet not found";
          await payment.save();

          return res.status(404).json({
            success: false,
            message: "Wallet not found",
          });
        }

        // Check if transaction already exists
        let transaction = await Transaction.findOne({
          reference: payment.transactionRef,
        });

        if (!transaction) {
          // Create transaction
          transaction = new Transaction({
            type: "deposit",
            amount: payment.amount,
            currency: payment.currency,
            status: "completed",
            recipientWallet: wallet._id,
            recipientId: payment.userId,
            reference: payment.transactionRef,
            description: "Deposit via Squad payment gateway",
            externalReference: payment.squadRef,
          });

          await transaction.save();

          // Add amount to wallet
          wallet.balance += payment.amount;
          await wallet.save();
        }

        // Update payment with transaction ID
        payment.transactionId = transaction._id;
        await payment.save();

        return res.status(200).json({
          success: true,
          message: "Payment verified successfully",
          data: {
            payment: {
              id: payment._id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              transactionRef: payment.transactionRef,
              createdAt: payment.createdAt,
            },
            transaction: {
              id: transaction._id,
              amount: transaction.amount,
              type: transaction.type,
              status: transaction.status,
              reference: transaction.reference,
              createdAt: transaction.createdAt,
            },
          },
        });
      } else {
        // Payment verification failed
        // In verifyDeposit, when payment verification fails:
        payment.status = "failed";
        payment.errorMessage =
          response.data.message || "Payment verification failed";
        // Don't use response.data.message if it's "Success" — that's misleading
        payment.errorMessage =
          response.data.data?.status !== "success"
            ? response.data.message || "Payment verification failed"
            : "Wallet or transaction error after successful payment";
        await payment.save();

        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
          error: response.data.message || "Unknown error",
        });
      }
    } catch (error) {
      // Handle API error
      payment.errorMessage = error.message || "Payment verification API error";
      payment.errorCode = error.response?.status || "NETWORK_ERROR";
      await payment.save();

      return res.status(500).json({
        success: false,
        message: "Payment verification error",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Deposit verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get deposit history for a user
 * @route GET /api/payments/deposit/history
 */
exports.getDepositHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    // Find all deposits for this user
    const deposits = await DepositPayment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await DepositPayment.countDocuments({ userId });

    // Map to a nicer format
    const formattedDeposits = await Promise.all(
      deposits.map(async (deposit) => {
        let transaction = null;

        if (deposit.transactionId) {
          transaction = await Transaction.findById(deposit.transactionId);
        }

        return {
          id: deposit._id,
          amount: deposit.amount,
          currency: deposit.currency,
          status: deposit.status,
          transactionRef: deposit.transactionRef,
          createdAt: deposit.createdAt,
          transaction: transaction
            ? {
                id: transaction._id,
                status: transaction.status,
                reference: transaction.reference,
              }
            : null,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: {
        deposits: formattedDeposits,
        pagination: {
          total,
          limit,
          skip,
        },
      },
    });
  } catch (error) {
    console.error("Deposit history error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
