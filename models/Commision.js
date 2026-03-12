const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commissionSchema = new Schema({
  commission_squad: {
    type: Number,
    required: true
  },
  commission_stripe: {
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
const Commission = mongoose.model('Commission', commissionSchema);

module.exports = Commission;
