const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction type (transfer, deposit, withdrawal)
  type: {
    type: String,
    enum: ['transfer', 'deposit', 'withdrawal'],
    required: true
  },
  
  // Amount and currency
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Transaction fee
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  // Total amount (amount + fee)
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed', 'pending_verification'],
    default: 'pending'
  },
  
  // Sender (may be null for deposits)
  senderWallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Recipient (may be null for withdrawals)
  recipientWallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Transaction reference (UPRN) - only required for user account transfers
  reference: {
    type: String,
    index: { unique: true, sparse: true } // Only ensure uniqueness when present
  },
  
  // Flag indicating if this transaction directly affects user accounts
  // Only user account transfers should have UPRNs
  isUserAccountTransfer: {
    type: Boolean,
    default: true
  },
  
  // Static user UPRN (for reconciliation of bank transfers)
  staticUserUprn: {
    type: String,
    index: true
  },
  
  description: {
    type: String,
    default: ''
  },
  
  // For deposits/withdrawals via external payment processors
  externalReference: {
    type: String
  },
  
  // Verification status
  verificationStatus: {
    type: String,
    enum: ['not_required', 'pending', 'verified', 'failed'],
    default: 'not_required'
  },
  
  // Link to the verification record if applicable
  verificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentVerification'
  },
  
  // Payment method for deposits
  paymentMethod: {
    type: String,
    enum: ['card', 'bank', 'wallet', 'cash'],
    default: 'wallet'
  },
  
  // Payment gateway for deposits
  paymentGateway: {
    type: String,
    enum: ['GTB', 'Switch', 'Internal'],
    default: 'Internal'
  },
  
  // Name provided by payment method (for verification)
  nameOnPaymentMethod: {
    type: String
  },
  
  // For failure cases
  failureReason: {
    type: String
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Add pre-save middleware to calculate total if not provided
transactionSchema.pre('save', function(next) {
  // Convert amount and fee to numbers if they're strings
  if (typeof this.amount === 'string') {
    this.amount = parseFloat(this.amount.replace(/[^0-9.-]+/g, ''));
  }
  if (typeof this.fee === 'string') {
    this.fee = parseFloat(this.fee.replace(/[^0-9.-]+/g, ''));
  }
  
  // Ensure amount and fee are valid numbers
  this.amount = this.amount || 0;
  this.fee = this.fee || 0;
  
  // Calculate total if not provided or recalculate if amount or fee changed
  this.total = this.amount + this.fee;
  
  next();
});

// Custom validation for reference field
transactionSchema.pre('validate', function(next) {
  // Only require a reference (UPRN) for user account transfers
  if (this.isUserAccountTransfer && !this.reference) {
    this.invalidate('reference', 'Reference (UPRN) is required for user account transfers');
  }
  next();
});

// Add indexes for faster querying
transactionSchema.index({ senderId: 1, createdAt: -1 });
transactionSchema.index({ recipientId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1 });
transactionSchema.index({ verificationStatus: 1 });
transactionSchema.index({ isUserAccountTransfer: 1 });

// Ensure model isn't redefined
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

module.exports = Transaction; 