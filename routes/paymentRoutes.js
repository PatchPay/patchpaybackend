const express = require('express');
const router = express.Router();
const paymentController = require('../Controllers/paymentController');
const depositRoutes = require('./depositRoutes');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Use the deposit routes for /deposit endpoints
router.use('/deposit', depositRoutes);

/**
 * @route   POST /api/payments
 * @desc    Create a new payment
 * @access  Private
 */
router.post('/', authMiddleware, paymentController.createPayment);

/**
 * @route   GET /api/payments
 * @desc    Get all payments
 * @access  Private/Admin
 */
router.get('/', authMiddleware, paymentController.getAllPayments);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', authMiddleware, paymentController.getPaymentById);

module.exports = router;
