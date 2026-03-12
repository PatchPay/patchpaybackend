const express = require("express");
const router = express.Router();
const depositController = require("../Controllers/depositController");
const { authenticateToken } = require("../middlewares/authMiddleware");

// Webhook route (no auth required)
router.post("/callback", depositController.handleWebhook);

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// Deposit routes
router.post("/initiate", depositController.initiateDeposit);
router.post("/verify", depositController.verifyDeposit);
router.get("/history", depositController.getDepositHistory);

module.exports = router;
