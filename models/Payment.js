const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  payment_method: {
    type: String,
    required: true,
    enum: ['Bank Transfer', 'Card', 'Wallet']
  },
  payment_type: {
    type: String,
    required: true,
    enum: ['Escrow Funding', 'Escrow Release', 'Escrow Refund', 'Wallet Funding']
  },
  transaction_reference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true // This will automatically add createdAt and updatedAt fields
});

// Create indexes for faster queries
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

// Ensure model isn't redefined
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
