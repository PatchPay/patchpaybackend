const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const deliveryAddressSchema = new Schema({
  street: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  postal_code: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  }
});

const quoteSchema = new Schema({
  quote_number: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['RFQ', 'Order'],  
    required: true
  },
  product_description: {
    type: String,
    required: true
  },
  product_quantity: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  uprn: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Cancelled'],  
    default: 'Pending'
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Referencing the User model
    required: true
  },
  destinatary_user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Referencing another user model for the recipient
    required: true
  },
  delivery_code: {
    type: Number,
    required: true
  },
  delivery_type: {
    type: String,
    enum: ['Standard', 'Secure'],
    required: true
  },
  trade_type: {
    type: String,
    enum: ['Domestic', 'International'],
    required: true
  },
  delivery_address: {
    type: deliveryAddressSchema,
    required: true
  },
  line_total: {
    type: Number,
    required: true
  },
  delivery_charge: {
    type: Number,
    required: true
  },
  transaction_charges: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  proof_delivery: {
    type: Schema.Types.ObjectId,
    ref: 'ProofDelivery',  // Assuming a reference to a ProofDelivery model
    required: true
  },
  coupon: [{
    type: Schema.Types.ObjectId,
    ref: 'Coupon'  // Assuming a reference to a Coupon model
  }],
  exchange_rate: {
    type: Number,
    default: 1
  },
  responseNotificationDue: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  deletionNotificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create indexes for notification queries
quoteSchema.index({ status: 1, responseNotificationDue: 1, notificationSent: 1 });
quoteSchema.index({ status: 1, updatedAt: 1, deletionNotificationSent: 1 });

// Create the model
const Quote = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);

module.exports = Quote;
