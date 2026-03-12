const mongoose = require('mongoose');

const paymentVerificationSchema = new mongoose.Schema({
  // User who made the payment
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment method used
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'squad_api'],
    required: true
  },
  
  // Payment amount and currency
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
  
  // UPRN for this payment
  uprn: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Name verification data (only for non-Squad payments)
  nameOnAccount: {
    type: String,
    sparse: true
  },
  registeredName: {
    type: String,
    sparse: true
  },
  nameVerified: {
    type: Boolean,
    default: true // Squad API payments are considered pre-verified
  },
  
  // Verification status
  status: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'expired'],
    default: 'pending'
  },
  
  // Reference from external payment gateway or bank
  externalReference: {
    type: String,
    sparse: true
  },
  
  // Squad API transaction reference
  squadRef: {
    type: String,
    sparse: true,
    index: true
  },
  
  // Error message if verification fails
  failureReason: {
    type: String
  },
  
  // Additional metadata about the payment
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Indexes for faster querying
paymentVerificationSchema.index({ userId: 1, createdAt: -1 });
paymentVerificationSchema.index({ status: 1 });

// Ensure model isn't redefined
const PaymentVerification = mongoose.models.PaymentVerification || mongoose.model('PaymentVerification', paymentVerificationSchema);

module.exports = PaymentVerification; 