const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const refundSchema = new Schema({
  payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  amount: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Requested', 'Processed', 'Rejected'],
    default: 'Requested'
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

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund;
