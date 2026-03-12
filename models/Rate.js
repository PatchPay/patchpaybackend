const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const rateSchema = new Schema({
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
const Rate = mongoose.model('Rate', rateSchema);

module.exports = Rate;
