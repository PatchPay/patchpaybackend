const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['success', 'error', 'info', 'warning'],
    default: 'info'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['transfer', 'wallet', 'account', 'system'],
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient querying
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema); 