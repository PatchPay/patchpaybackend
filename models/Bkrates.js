const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bkRatesSchema = new Schema({
  code_transfer: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',  // Assuming the 'Amount' model holds the actual amount
    required: true
  },
  currency: {
    type: String,
    required: true
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

// Create the model
const BkRates = mongoose.model('BkRates', bkRatesSchema);

module.exports = BkRates;
