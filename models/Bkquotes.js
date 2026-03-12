const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quoteStatusSchema = new Schema({
  quote: {
    type: Schema.Types.ObjectId,
    ref: 'Quote',  // Referencing the Quote model
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Rejected'],  // Possible statuses for a quote
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
const QuoteStatus = mongoose.model('QuoteStatus', quoteStatusSchema);

module.exports = QuoteStatus;
