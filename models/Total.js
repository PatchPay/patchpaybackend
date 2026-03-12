const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const totalSchema = new Schema({
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
const Total = mongoose.model('Total', totalSchema);

module.exports = Total;
