const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { checkEscrowPermission } = require('../middlewares/escrowMiddleware');
const {
  createTransaction,
  getEscrowTransactions,
  getTransactionById,
  getTransactionByReference,
  updateTransactionStatus
} = require('../Controllers/escrowTransactionController.js');

// Create a new transaction
router.post(
  '/:id/create',
  authenticateToken,
  checkEscrowPermission,
  createTransaction
);

// Get all transactions for an escrow
router.get(
  '/escrow/:escrowId',
  authenticateToken,
  checkEscrowPermission,
  getEscrowTransactions
);

// Get transaction by reference number
router.get(
  '/reference/:reference',
  authenticateToken,
  getTransactionByReference
);

// Get transaction by ID
router.get(
  '/:transactionId',
  authenticateToken,
  getTransactionById
);

// Update transaction status
router.patch(
  '/:transactionId/status',
  authenticateToken,
  updateTransactionStatus
);

module.exports = router; 