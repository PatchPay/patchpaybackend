const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const creditMyAccountBksSchema = new Schema({
  amount: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',  // Assuming you have an Amount model to store the amount data
    required: true
  },
  uprn: {
    type: String,
    required: true
  },
  user_ref: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Referencing the User model
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected'],  // Assuming status can be 'Pending', 'Accepted', or 'Rejected'
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
const CreditMyAccountBks = mongoose.model('CreditMyAccountBks', creditMyAccountBksSchema);

module.exports = CreditMyAccountBks;
