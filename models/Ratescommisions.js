const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const financialDataSchema = new Schema({
  commissions_national: {
    type: Schema.Types.ObjectId,  // Assuming these are references to other models
    ref: 'Commission',
    required: true
  },
  total_national: {
    type: Schema.Types.ObjectId,
    ref: 'Total',
    required: true
  },
  commissions_international: {
    type: Schema.Types.ObjectId,
    ref: 'Commission',
    required: true
  },
  total_international: {
    type: Schema.Types.ObjectId,
    ref: 'Total',
    required: true
  },
  // New rate fields directly added to the Financial Data model
  rate_international_squad: {
    type: Number,
    required: true
  },
  rate_international_stripe: {
    type: Number,
    required: true
  },
  rate_national_squad: {
    type: Number,
    required: true
  },
  rate_national_stripe: {
    type: Number,
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
const FinancialData = mongoose.model('FinancialData', financialDataSchema);

module.exports = FinancialData;
