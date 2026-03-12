const mongoose = require('mongoose');

const depositPaymentSchema = new mongoose.Schema({
  // User who made the deposit
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Amount and currency
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  
  // Transaction references
  transactionRef: {
    type: String,
    required: true,
    index: { unique: true }
  },
  squadRef: {
    type: String,
    index: { unique: true, sparse: true }
  },
  
  // Payment status
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'reversed'],
    default: 'pending'
  },
  
  // Payment gateway data
  gatewayResponse: {
    type: Object
  },
  gatewayResponseCode: {
    type: String
  },
  
  // Transaction ID (after successful deposit)
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Metadata
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Error information
  errorMessage: {
    type: String
  },
  errorCode: {
    type: String
  }
}, { timestamps: true });

// Add indexes for faster querying
depositPaymentSchema.index({ userId: 1, createdAt: -1 });
depositPaymentSchema.index({ status: 1 });

// Check if the model exists before creating it
module.exports = mongoose.models.DepositPayment || mongoose.model('DepositPayment', depositPaymentSchema); 