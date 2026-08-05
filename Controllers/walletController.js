const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const Notification = require("../models/Notification");

// Adjust this import to wherever your Sequelize instance is exported from
// (commonly `../models` if you're using the Sequelize CLI's models/index.js)
const  sequelize  = require("../config/database");
const { Op } = require("sequelize");

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  generateAccountNumber,
  formatAmount,
} = require("../utils/accountUtils");
const {
  generateUPRN,
  generateStaticUserUPRN,
  validateNameMatch,
  transactionNeedsUPRN,
} = require("../utils/paymentUtils");
const {
  calculateTransactionFee,
  getCurrencyForUser,
} = require("../utils/transactionFeeUtils");
const transferService = require("../services/transfer.service");

/**
 * Initialize wallet for a user
 * @route POST /api/wallet/initialize
 */
exports.initializeWallet = async (req, res) => {
  try {
    console.log("Request to initialize wallet received");

    if (!req.user) {
      console.error("No user attached to request");
      return res.status(401).json({
        success: false,
        message: "Authentication failed. User not found.",
      });
    }

    const userId = req.user.id;
    console.log("Using userId:", userId);

    // Get only wallet type information from request
    // Ignoring country/currency from client for security
    const { accountType, walletType } = req.body;

    // Check if user exists in the database
    const user = await User.findByPk(userId);
    if (!user) {
      console.error("User not found in database with ID:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    console.log("Found user in database:", user.email);

    console.log("User country details from DB:", {
      country: user.country,
      countryCode: user.countryCode,
      continent: user.continent,
    });

    // ENHANCED CHECK: Verify user has all required data for wallet initialization
    const missingData = [];
    if (!user.country) missingData.push("country");
    if (!user.countryCode) missingData.push("country code");
    if (!user.continent) missingData.push("continent");

    if (missingData.length > 0) {
      console.error(
        `User ${userId} is missing required profile data:`,
        missingData,
      );
      return res.status(400).json({
        success: false,
        message: `Cannot initialize wallet: Your profile is missing the following required information: ${missingData.join(", ")}. Please update your profile before creating a wallet.`,
      });
    }

    // Extra validation - ensure countryCode is a valid 2-letter code
    if (user.countryCode.length !== 2) {
      console.error(
        `User ${userId} has invalid country code format: ${user.countryCode}`,
      );
      return res.status(400).json({
        success: false,
        message: `Cannot initialize wallet: Your profile has an invalid country code format. Country codes must be 2 letters (e.g., GB, US, NG).`,
      });
    }

    // Always use the database information, not client-provided data
    const { country, countryCode, continent } = user;
    let currency;

    // Determine currency based on database user data only
    try {
      // SPECIAL CASE: For United Kingdom, explicitly set GBP
      if (country === "United Kingdom" || countryCode === "GB") {
        console.log(
          "UK user detected: explicitly setting currency to GBP",
        );
        currency = "GBP";
      } else {
        currency = getCurrencyForUser(user.toJSON());
        console.log(
          `Determined currency ${currency} based on user's database data`,
        );
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: `Cannot initialize wallet: ${error.message}. Please update your profile with a valid country.`,
      });
    }

    if (!currency) {
      console.error("Could not determine currency for user");
      return res.status(400).json({
        success: false,
        message:
          "Cannot initialize wallet: Currency cannot be determined from your profile data. Please update your profile with a valid country.",
      });
    }

    console.log("Currency for wallet (from database):", currency);

    // Check if user is verified and active
    console.log("User verification status:", {
      emailVerified: user.emailVerified,
      status: user.status_client,
    });

    if (!user.emailVerified || user.status_client !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Account must be verified and active to initialize a wallet",
      });
    }

    // Check if user already has a wallet
    console.log("Checking for existing wallet...");
    let wallet = await Wallet.findOne({ where: { userId } });

    if (wallet) {
      console.log(
        `User ${userId} already has a wallet with account ${wallet.accountNumber}`,
      );
      return res.status(200).json({
        success: true,
        message: "Wallet already initialized",
        data: {
          accountNumber: wallet.accountNumber,
          balance: formatAmount(wallet.balance, wallet.currency),
          rawBalance: wallet.balance,
          availableBalance: formatAmount(wallet.balance, wallet.currency),
          rawAvailableBalance: wallet.balance,
          currency: wallet.currency,
          isActive: wallet.isActive,
        },
      });
    }

    console.log("No existing wallet, creating new wallet...");

    // Generate account number based on user's country code
    let accountNumber = generateAccountNumber(user.countryCode);
    console.log("Generated account number:", accountNumber);

    // Verify the account number is unique
    const existingAccountCheck = await Wallet.findOne({
      where: { accountNumber },
    });
    if (existingAccountCheck) {
      console.error(
        `Generated duplicate account number: ${accountNumber}, regenerating...`,
      );
      // If there's a collision, generate a new account number
      // This is unlikely but added as a safeguard
      accountNumber = generateAccountNumber(user.countryCode);
      console.log("Regenerated account number:", accountNumber);
    }

    // Create new wallet
    wallet = await Wallet.create({
      userId,
      accountNumber,
      balance: 0,
      currency,
      isActive: true,
    });

    console.log(
      `Wallet created successfully for user ${userId} with account ${accountNumber}`,
    );

    // Return the created wallet
    return res.status(201).json({
      success: true,
      message: "Wallet initialized successfully",
      data: {
        accountNumber: wallet.accountNumber,
        balance: formatAmount(wallet.balance, wallet.currency),
        rawBalance: wallet.balance,
        availableBalance: formatAmount(wallet.balance, wallet.currency),
        rawAvailableBalance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
      },
    });
  } catch (error) {
    console.error("Error initializing wallet:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize wallet",
      error: error.message,
    });
  }
};

/**
 * Get wallet balance
 * @route GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        balance: formatAmount(wallet.balance, wallet.currency),
        rawBalance: wallet.balance,
        currency: wallet.currency,
      },
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wallet balance",
      error: error.message,
    });
  }
};

/**
 * Get transaction history
 * @route GET /api/wallet/transactions
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 5, skip = 0 } = req.query;

    // Base filter: user is either sender or recipient
    const where = {
      [Op.or]: [{ senderId: userId }, { recipientId: userId }],
    };

    if (req.query.type) {
      where.type = req.query.type;
    }

    if (req.query.status) {
      where.status = req.query.status;
    }

    const total = await Transaction.count({ where });

    const transactions = await Transaction.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
      offset: parseInt(skip, 10),
      include: [
        { model: User, as: "sender" },
        { model: User, as: "recipient" },
      ],
    });

    console.log(`Found ${transactions.length} transactions for user ${userId}`);

    const formattedTransactions = transactions.map((transaction) => {
      const senderIdStr = transaction.senderId
        ? transaction.senderId.toString()
        : "";
      const recipientIdStr = transaction.recipientId
        ? transaction.recipientId.toString()
        : "";
      const userIdStr = userId.toString();

      const isOutgoing = senderIdStr === userIdStr;

      // Get the counterparty based on transaction direction (via include).
      const counterparty = isOutgoing
        ? transaction.recipient
        : transaction.sender;

      const counterpartyId = counterparty ? counterparty.id.toString() : "";

      // Determine counterparty name based on account type
      let counterpartyName = "Unknown";
      if (counterparty) {
        if (counterparty.firstName) {
          counterpartyName =
            `${counterparty.firstName} ${counterparty.surname || ""}`.trim();
        } else if (counterparty.businessName) {
          counterpartyName = counterparty.businessName;
        } else if (counterparty.organizationName) {
          counterpartyName = counterparty.organizationName;
        } else if (counterparty.departmentName) {
          counterpartyName = counterparty.departmentName;
        } else if (counterparty.email) {
          counterpartyName = counterparty.email;
        }
      }

      return {
        id: transaction.id,
        type: transaction.type,
        amount: formatAmount(
          isOutgoing ? -transaction.total : transaction.amount,
          transaction.currency,
        ),
        fee: formatAmount(transaction.fee, transaction.currency),
        total: formatAmount(transaction.total, transaction.currency),
        currency: transaction.currency,
        direction: isOutgoing ? "outgoing" : "incoming",
        status: transaction.status,
        date: transaction.createdAt,
        reference: transaction.reference,
        description: transaction.description || "",
        paymentMethod: transaction.paymentMethod,
        senderId: senderIdStr,
        recipientId: recipientIdStr,
        counterparty: counterparty
          ? {
              id: counterpartyId,
              name: counterpartyName,
              email: counterparty.email || "",
              accountType: counterparty.accountType || "Unknown",
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          total,
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
        },
      },
    });
  } catch (error) {
    console.error("Error getting transaction history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get transaction history",
      error: error.message,
    });
  }
};

/**
 * Transfer funds from one wallet to another
 * @route POST /api/wallet/transfer
 */
exports.transferFunds = async (req, res) => {
  try {
    const result = await transferService.internalTransfer({
      user: req.user,
      recipientAccount: req.body.recipientAccount,
      amount: Number(req.body.amount),
      description: req.body.description,
      transactionPin: req.body.transactionPin,
      idempotencyKey:
        req.headers["idempotency-key"] ||
        req.headers["x-idempotency-key"] ||
        req.body.idempotencyKey,
    });

    return res.status(result.repeated ? 200 : 201).json({
      success: true,
      repeated: result.repeated,
      data: {
        transactionId: result.transaction.id,
        reference: result.transaction.reference,
        amount: result.transaction.amount,
        fee: result.transaction.fee,
        total: result.transaction.total,
        currency: result.transaction.currency,
        status: result.transaction.status,
        senderBalance: result.senderBalance,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Error processing transfer",
    });
  }
};

/**
 * Get wallet details including account and available balance
 */
exports.getWalletDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ where: { userId } });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    // Calculate available balance by subtracting pending outgoing transactions
    const pendingTransactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { senderId: userId, status: "pending" },
          { recipientId: userId, status: "pending" },
        ],
      },
    });

    let pendingAmount = 0;
    pendingTransactions.forEach((transaction) => {
      // If user is sender, subtract the amount
      if (
        transaction.senderId &&
        transaction.senderId.toString() === userId.toString()
      ) {
        pendingAmount += transaction.amount;
      }
      // We don't add pending incoming funds to available balance
    });

    const availableBalance = Math.max(0, wallet.balance - pendingAmount);

    return res.status(200).json({
      success: true,
      data: {
        accountNumber: wallet.accountNumber,
        balance: Number(wallet.balance),
        rawBalance: Number(wallet.balance),
        availableBalance: Number(availableBalance),
        rawAvailableBalance: Number(availableBalance),
        currency: wallet.currency,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting wallet details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get wallet details",
      error: error.message,
    });
  }
};

/**
 * Verify if an account number exists and get user info
 * @route GET /api/wallet/verify-account/:accountNumber
 */
exports.verifyAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    if (!accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Account number is required",
      });
    }

    // Prevent verifying your own account
    const userWallet = await Wallet.findOne({
      where: { userId: req.user.id },
    });
    if (userWallet && userWallet.accountNumber === accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Cannot add your own account as a recipient",
      });
    }

    // Find wallet by account number
    const wallet = await Wallet.findOne({ where: { accountNumber } });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const user = await User.findByPk(wallet.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User associated with this account not found",
      });
    }

    // Get full name based on account type
    let fullName = "";

    if (user.accountType === "Personal") {
      fullName =
        `${user.firstName || ""} ${user.middleName || ""} ${user.surname || ""}`.trim();
    } else if (user.accountType === "NGO") {
      fullName = user.organizationName || "";
    } else if (user.accountType === "Merchant") {
      fullName = user.businessName || "";
    } else if (user.accountType === "Government") {
      fullName = user.departmentName || "";
    } else {
      fullName = user.email || "Anonymous User";
    }

    return res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        accountNumber: wallet.accountNumber,
        userName: fullName,
        accountType: user.accountType,
        currency: wallet.currency,
      },
    });
  } catch (error) {
    console.error("Error verifying account:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify account",
      error: error.message,
    });
  }
};

/**
 * Deposit funds
 * @route POST /api/wallet/deposit
 */
exports.depositFunds = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { amount, paymentMethod, paymentDetails = {} } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    // Validate payment method
    const validPaymentMethods = ["card", "bank_transfer", "offline_transfer"];
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid payment method is required",
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({
      where: { userId },
      transaction: t,
    });
    if (!wallet) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    // Get user information for the transaction record
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate UPRN for this deposit
    const depositUprn = generateUPRN(userId, "deposit");
    const staticUserUprn = generateStaticUserUPRN(userId);
    const depositDescription =
      paymentDetails.description || "Deposit to wallet";

    // Create deposit transaction record - status will be pending initially
    const transaction = await Transaction.create(
      {
        recipientId: userId,
        recipientWallet: wallet.id,
        amount,
        currency: wallet.currency,
        type: "deposit",
        status: "pending", // Will be updated after payment is confirmed
        reference: depositUprn,
        isUserAccountTransfer: true,
        staticUserUprn,
        description: depositDescription,
        paymentMethod,
        verificationStatus: "pending",
        metadata: {
          paymentDetails,
          nameOnPaymentMethod: paymentDetails.nameOnPayment || "",
          recipientName: user.firstName
            ? `${user.firstName} ${user.surname || ""}`.trim()
            : user.email,
          recipientAccountType: user.accountType || "Personal",
        },
      },
      { transaction: t },
    );

    let response = {
      success: true,
      message: "Deposit initiated successfully",
      data: {
        transaction: {
          id: transaction.id,
          reference: depositUprn,
          staticUserUprn,
          amount: formatAmount(amount, wallet.currency),
          currency: wallet.currency,
          status: transaction.status,
          paymentMethod,
          description: depositDescription,
        },
      },
    };

    // For offline transfers, provide bank account information
    if (paymentMethod === "offline_transfer") {
      response.data.bankDetails = {
        accountName: "PatchPay Ltd",
        accountNumber: "1234567890",
        bankName: "Sample Bank",
        reference: depositUprn,
        instructions:
          "Please include the reference number in your payment description",
      };
    }

    await t.commit();

    return res.status(200).json(response);
  } catch (error) {
    await t.rollback();
    console.error("Error initiating deposit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate deposit",
      error: error.message,
    });
  }
};

/**
 * Calculate transaction fee without performing the transaction
 * @route POST /api/wallet/calculate-fee
 */
exports.calculateFee = async (req, res) => {
  try {
    const { recipientAccount, amount } = req.body;
    const senderId = req.user.id;

    if (!recipientAccount || !amount) {
      return res.status(400).json({
        success: false,
        message: "Recipient account and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const senderWallet = await Wallet.findOne({ where: { userId: senderId } });

    if (!senderWallet) {
      return res.status(404).json({
        success: false,
        message: "Sender wallet not found",
      });
    }

    const recipientWallet = await Wallet.findOne({
      where: { accountNumber: recipientAccount },
    });

    if (!recipientWallet) {
      return res.status(404).json({
        success: false,
        message: "Recipient account not found",
      });
    }

    const recipientUser = await User.findByPk(recipientWallet.userId);

    if (!recipientUser) {
      return res.status(404).json({
        success: false,
        message: "Recipient user not found",
      });
    }

    const senderUser = await User.findByPk(senderId);

    if (!senderUser) {
      return res.status(404).json({
        success: false,
        message: "Sender user not found",
      });
    }

    // Prevent transfers to self
    if (senderId.toString() === recipientUser.id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself",
      });
    }

    const feeDetails = calculateTransactionFee(
      senderUser,
      recipientUser,
      amount,
    );

    const total = amount + feeDetails.feeAmount;

    return res.status(200).json({
      success: true,
      data: {
        amount: formatAmount(amount, senderWallet.currency),
        rawAmount: amount,
        fee: formatAmount(feeDetails.feeAmount, senderWallet.currency),
        rawFee: feeDetails.feeAmount,
        total: formatAmount(total, senderWallet.currency),
        rawTotal: total,
        currency: senderWallet.currency,
        feeDetails: {
          percentage: feeDetails.feePercentage,
          flatFee: feeDetails.flatFee,
          description: feeDetails.feeDescription,
          isInternational: feeDetails.isInternational,
          isCrossContinental: feeDetails.isCrossContinental,
        },
        paymentGateway: feeDetails.paymentGateway,
        recipientName: recipientUser.firstName
          ? `${recipientUser.firstName} ${recipientUser.surname || ""}`.trim()
          : recipientUser.email,
      },
    });
  } catch (error) {
    console.error("Error calculating transaction fee:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate transaction fee",
      error: error.message,
    });
  }
};
