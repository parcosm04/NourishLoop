const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  role: { type: String, enum: ['donor', 'receiver'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  organizationName: { type: String },
  organizationType: { type: String }, // e.g. Restaurant, Bakery, Mess, NGO, Food Bank, Shelter
  address: { type: String },
  city: { type: String },
  location: {
    lat: { type: Number, default: 40.7128 },
    lng: { type: Number, default: -74.0060 }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
