const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

// Create a new payment
exports.createPayment = async (req, res) => {
  const { user, amount, payment_method, transaction_reference } = req.body;

  try {
    const newPayment = new Payment({
      user,
      amount,
      payment_method,
      transaction_reference,
      status: 'Pending'
    });

    await newPayment.save();

    // Create a transaction for the payment
    const newTransaction = new Transaction({
      type: 'deposit',
      amount,
      reference: transaction_reference,
      recipientId: user,
      status: 'pending',
      description: `Payment via ${payment_method}`
    });

    await newTransaction.save();

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: {
        payment: newPayment,
        transaction: newTransaction
      }
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment',
      error: error.message
    });
  }
};

// Get all payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
