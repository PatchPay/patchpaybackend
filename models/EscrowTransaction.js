const mongoose = require('mongoose');

const escrowTransactionSchema = new mongoose.Schema({
  transactionReference: {
    type: String,
    required: true,
    unique: true
  },
  escrowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['FUND', 'RELEASE', 'REFUND'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  balanceAfterTransaction: {
    type: Number,
    required: true
  },
  outstandingBalanceAfterTransaction: {
    type: Number,
    required: true
  },
  originalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  metadata: {
    paymentMethod: String,
    paymentReference: String,
    description: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Function to generate transaction reference
function generateTransactionReference() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ESC-TXN-${timestamp}-${random}`;
}

// Generate transaction reference before saving
escrowTransactionSchema.pre('save', async function(next) {
  try {
    if (!this.transactionReference) {
      let isUnique = false;
      let reference;

      // Keep generating until we find a unique reference
      while (!isUnique) {
        reference = generateTransactionReference();
        const existingTransaction = await this.constructor.findOne({ transactionReference: reference });
        if (!existingTransaction) {
          isUnique = true;
        }
      }

      this.transactionReference = reference;
    }
    
    this.updatedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('EscrowTransaction', escrowTransactionSchema); 