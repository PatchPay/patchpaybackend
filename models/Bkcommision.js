const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bkCommissionsSchema = new Schema({
  uprn: {
    type: String,
    required: true
  },
  amount: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',  // Assuming you have an 'Amount' model for the actual amount data
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
const BkCommissions = mongoose.model('BkCommissions', bkCommissionsSchema);

module.exports = BkCommissions;
