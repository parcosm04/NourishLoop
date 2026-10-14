const express = require('express');
const router = express.Router();
const User = require('../models/User');

const mongoose = require('mongoose');

// Register or Sync user profile from Firebase
router.post('/sync', async (req, res) => {
  try {
    const {
      uid,
      email,
      role,
      name,
      phone,
      organizationName,
      organizationType,
      address,
      city,
      location,
      isRegistration
    } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    // If MongoDB is currently disconnected, return a fallback profile so login is never blocked
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not ready (readyState !== 1). Returning temporary profile for:', uid);
      return res.status(200).json({
        uid,
        email: email || '',
        role: role || 'donor',
        name: name || (email ? email.split('@')[0] : 'Contributor'),
        phone: phone || '',
        organizationName: organizationName || '',
        organizationType: organizationType || '',
        address: address || '',
        city: city || '',
        location: location || { lat: 40.7128, lng: -74.0060 },
        _isFallback: true
      });
    }

    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({
        uid,
        email: email || '',
        role: role || 'donor',
        name: name || (email ? email.split('@')[0] : 'Contributor'),
        phone: phone || '',
        organizationName: organizationName || '',
        organizationType: organizationType || '',
        address: address || '',
        city: city || '',
        location: location || { lat: 40.7128, lng: -74.0060 }
      });
      await user.save();
    } else {
      // Update existing record if new information is provided
      if (email && email !== user.email) user.email = email;
      // Only overwrite role if during explicit registration or user has no role
      if (isRegistration && role && role !== user.role) user.role = role;
      if (name && name !== user.name && name !== 'Anonymous Contributor') user.name = name;
      if (phone !== undefined && phone !== '') user.phone = phone;
      if (organizationName !== undefined && organizationName !== '') user.organizationName = organizationName;
      if (organizationType !== undefined && organizationType !== '') user.organizationType = organizationType;
      if (address !== undefined && address !== '') user.address = address;
      if (city !== undefined && city !== '') user.city = city;
      if (location) user.location = location;

      await user.save();
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error syncing user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile by UID
router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
