const express = require("express");
const router = express.Router();
const walletController = require("../Controllers/walletController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Apply auth middleware to all wallet routes
router.use(authMiddleware);

// Initialize wallet
router.post("/initialize", walletController.initializeWallet);

// Get wallet balance
router.get("/balance", walletController.getBalance);

// Get wallet details
router.get("/details", walletController.getWalletDetails);

// Get transaction history
router.get("/transactions", walletController.getTransactionHistory);

// Transfer funds
router.post("/transfer", walletController.transferFunds);

// Calculate transaction fee
router.post("/calculate-fee", walletController.calculateFee);

// Verify account
router.get("/verify-account/:accountNumber", walletController.verifyAccount);

// Deposit funds
router.post("/deposit", walletController.depositFunds);

module.exports = router;
