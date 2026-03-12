const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transferSchema = new Schema({
  code_transfer: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Refund', 'Pending', 'Completed'],  // You can add more statuses if needed
    required: true
  },
  amount: {
    type: String,  // The amount seems to be a reference, so it's a string (could be an object ID or similar)
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Assuming you have a 'User' model to reference
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
const Transfer = mongoose.model('Transfer', transferSchema);

module.exports = Transfer;
