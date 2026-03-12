const mongoose = require('mongoose');

const quoteHistorySchema = new mongoose.Schema({
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Cancelled', 'Deleted'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  notificationDue: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  deletionDue: {
    type: Date
  },
  deletionNotificationSent: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient querying
quoteHistorySchema.index({ notificationDue: 1 });
quoteHistorySchema.index({ deletionDue: 1 });
quoteHistorySchema.index({ quote: 1, createdAt: -1 });

module.exports = mongoose.model('QuoteHistory', quoteHistorySchema); 