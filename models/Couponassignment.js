const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponAssignmentSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Assuming you already have the 'User' model
    required: true
  },
  coupon: {
    type: Schema.Types.ObjectId,
    ref: 'Coupon',  // Assuming you have a 'Coupon' model
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

// Create model
const CouponAssignment = mongoose.model('CouponAssignment', couponAssignmentSchema);

module.exports = CouponAssignment;
