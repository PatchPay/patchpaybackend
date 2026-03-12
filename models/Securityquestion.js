const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const securityQuestionSetSchema = new Schema({
  questions: [{
    type: String,  // Each question is a string
    required: true
  }],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // References the User model
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
const SecurityQuestionSet = mongoose.model('SecurityQuestionSet', securityQuestionSetSchema);

module.exports = SecurityQuestionSet;
