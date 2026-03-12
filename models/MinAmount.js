const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the schema
const minAmountSchema = new Schema({
  squad: {
    type: Number,
    required: true
  },
  stripe: {
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
const MinAmount = mongoose.model('MinAmount', minAmountSchema);

// Export the model using CommonJS
module.exports = MinAmount;

