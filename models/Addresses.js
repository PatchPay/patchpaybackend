import mongoose from 'mongoose';  // Use ES Module import syntax

const { Schema } = mongoose;  // Destructure Schema directly from mongoose

// Define the schema for Addresses
const addressSchema = new Schema({
  addresses: [{
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postal_code: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    }
  }],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',  // Referencing the User model to link the addresses to a user
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
const Addresses = mongoose.model('Addresses', addressSchema);


export default Addresses;
