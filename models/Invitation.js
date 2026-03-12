const mongoose = require('mongoose');
const { Schema } = mongoose;

const invitationSchema = new Schema({
  contact: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['email'],
    default: 'email'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster queries
invitationSchema.index({ contact: 1 });
invitationSchema.index({ expiresAt: 1 });

const Invitation = mongoose.model('Invitation', invitationSchema);

module.exports = Invitation; 