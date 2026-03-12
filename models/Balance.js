const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const balanceSchema = new Schema({
  balance: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',  // Assuming you have an 'Amount' model for the actual balance data
    required: true
  },
  available_balance: {
    type: Schema.Types.ObjectId,
    ref: 'Amount',  // Assuming a reference to the 'Amount' model
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Referencing the 'User' model to link the balance to a specific user
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
const Balance = mongoose.model('Balance', balanceSchema);

module.exports = Balance;
