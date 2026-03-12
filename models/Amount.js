const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const amountSchema = new Schema({
  value: {
    type: Number,
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
const Amount = mongoose.model('Amount', amountSchema);

module.exports = Amount;
