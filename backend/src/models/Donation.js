const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  foodItem: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  expiryTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['available', 'pending_approval', 'claimed', 'completed', 'rejected'], 
    default: 'available' 
  },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  claimedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', donationSchema);
