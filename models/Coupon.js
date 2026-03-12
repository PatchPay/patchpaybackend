const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  use: {
    type: String,
    enum: ['Amount_N', 'Percentage'],  // Assuming it's either an amount or a percentage
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['Limit number of users', 'Unlimited'],  // Assuming it’s either limited or unlimited
    required: true
  },
  start_date: {
    type: Date,
    default: Date.now
  },
  end_date: {
    type: Date,
    default: Date.now
  },
  limit_users: {
    type: Number,
    default: 0
  },
  country: {
    type: String,
    default: null  // Assuming this could be optional or null
  },
  status: {
    type: Boolean,
    default: false
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

// Create model
const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
