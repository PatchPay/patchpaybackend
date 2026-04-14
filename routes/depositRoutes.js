const express = require("express");
const router = express.Router();
const depositController = require("../Controllers/depositController");
const { authenticateToken } = require("../middlewares/authMiddleware");

// Webhook route (no auth required)
router.get("/callback", depositController.handleCallback);
router.post("/verify", depositController.verifyDeposit);
router.post("/webhook", depositController.handleWebhook);

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// Deposit routes
router.post("/initiate", depositController.initiateDeposit);

router.get("/history", depositController.getDepositHistory);

module.exports = router;

// const express = require("express");
// const router = express.Router();
// const depositController = require("../Controllers/depositController");
// const { authenticateToken } = require("../middlewares/authMiddleware");

// // 🔥 PUBLIC ROUTES

// // Webhook (Squad → backend)
// // router.post("/webhook", depositController.handleWebhook);

// // Callback (browser redirect)
// router.get("/callback", depositController.handleCallback);

// // 🔒 PROTECTED ROUTES
// router.use(authenticateToken);

// // User actions
// router.post("/initiate", depositController.initiateDeposit);
// router.post("/verify", depositController.verifyDeposit);

// module.exports = router;
