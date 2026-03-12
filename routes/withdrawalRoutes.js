const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Webhook route (no auth required)
router.post('/webhook', withdrawalController.webhookHandler);

// Apply authentication middleware to all other routes
router.use(authenticateToken);

// Withdrawal routes
router.post('/initiate', withdrawalController.initiateWithdrawal);
router.post('/verify', withdrawalController.verifyWithdrawal);
router.get('/banks', withdrawalController.getBanks);
router.post('/resolve-account', withdrawalController.resolveAccount);
router.get('/history', withdrawalController.getWithdrawalHistory);

module.exports = router; 