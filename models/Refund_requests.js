const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const requestSchema = new Schema({
  request_number: {
    type: String,
    required: true,
    unique: true
  },
  reason: {
    type: String,
    required: true
  },
  additional_info: {
    type: String,
    default: ''  // Assuming it's optional and defaults to an empty string
  },
  url_photo: [{
    type: String,  // Assuming these are URLs to photos, stored as strings
    default: []  // Empty array if no photos are provided
  }],
  uprn: {
    type: String,
    required: true
  },
  quote_number: {
    type: Schema.Types.ObjectId,
    ref: 'Quote',  // Assuming a 'Quote' model exists
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
const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
