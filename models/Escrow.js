const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  // The user who created the escrow (sender)
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // The recipient of the funds when released
  recipientId: {
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
  currentBalance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'NGN'
  },
  
  // Escrow status
  status: {
    type: String,
    enum: ['CREATED', 'PARTIALLY_FUNDED', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'CANCELLED'],
    default: 'CREATED'
  },
  
  // UPRN for this escrow
  escrowUprn: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Transaction references
  fundingTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  releaseTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  refundTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // Conditions for release
  conditions: {
    type: String,
    required: true
  },
  
  // Expiry date (when funds are automatically returned if not released)
  expiryDate: {
    type: Date
  },
  
  // Description of the escrow purpose
  description: {
    type: String,
    required: true
  },
  
  // Additional metadata
  metadata: {
    quote_id: String,
    quote_number: String
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for faster querying
escrowSchema.index({ creatorId: 1, createdAt: -1 });
escrowSchema.index({ recipientId: 1, status: 1 });
escrowSchema.index({ status: 1 });
escrowSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // Auto-expire 30 days after expiry

// Virtual field for outstanding balance
escrowSchema.virtual('outstandingBalance').get(function() {
  return this.amount - (this.currentBalance || 0);
});

// Update the updatedAt timestamp before saving
escrowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure virtuals are included in JSON output
escrowSchema.set('toJSON', { virtuals: true });
escrowSchema.set('toObject', { virtuals: true });

// Ensure model isn't redefined
const Escrow = mongoose.models.Escrow || mongoose.model('Escrow', escrowSchema);

module.exports = Escrow; 