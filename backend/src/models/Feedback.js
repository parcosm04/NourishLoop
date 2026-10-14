const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  organizationName: { type: String },
  role: { type: String, enum: ['donor', 'receiver', 'general'], default: 'general' },
  category: { 
    type: String, 
    enum: ['Platform Experience', 'Surplus Handoff', 'Feature Suggestion', 'Bug Report', 'General'],
    default: 'General'
  },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  message: { type: String, required: true },
  emailSent: { type: Boolean, default: false },
  emailPreviewUrl: { type: String }, // For Ethereal test inbox links if tested without SMTP
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
