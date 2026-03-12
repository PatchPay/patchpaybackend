const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const dispatchSchema = new Schema({
  type: {
    type: String,
    enum: ['Standard', 'Express'],  // You can add more dispatch types if needed
    required: true
  },
  address: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,  // Assuming time is stored as a string (e.g., "10pm")
    required: true
  },
  company: {
    type: String,
    required: true
  },
  dispatch_recipient: {
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

// Create model
const Dispatch = mongoose.model('Dispatch', dispatchSchema);

module.exports = Dispatch;
