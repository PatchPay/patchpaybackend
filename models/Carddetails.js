const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cardDetailsSchema = new Schema({
  card_number: {
    type: String,
    required: true,
    unique: true
  },
  card_holder_name: {
    type: String,
    required: true
  },
  expiry_date: {
    type: Date,
    required: true
  },
  cvv: {
    type: String,
    required: true
  },
  billing_address: {
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
const CardDetails = mongoose.model('CardDetails', cardDetailsSchema);

module.exports = CardDetails;
