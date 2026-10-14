const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const User = require('../models/User');
const mongoose = require('mongoose');

// Fast-path guard: avoid 10s Mongoose buffer timeouts if MongoDB is reconnecting or disconnected
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    return res.status(503).json({
      error: 'Database is currently unavailable. Please ensure your IP address is whitelisted in MongoDB Atlas Network Access.'
    });
  }
  next();
});

// 1. Get all available donations (for Receiver feed)
router.get('/', async (req, res) => {
  try {
    const donations = await Donation.find({ status: 'available' })
      .populate('donorId', 'name organizationName location phone email');
    res.status(200).json(donations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get all listings by a specific Donor (Live active + Historical archive)
router.get('/donor/:donorUid', async (req, res) => {
  try {
    const donor = await User.findOne({ uid: req.params.donorUid });
    if (!donor) {
      return res.status(404).json({ error: 'Donor not found' });
    }

    const donations = await Donation.find({ donorId: donor._id })
      .populate('receiverId', 'name organizationName phone email')
      .sort({ createdAt: -1 });

    res.status(200).json(donations);
  } catch (error) {
    console.error('Error fetching donor listings:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a new donation
router.post('/', async (req, res) => {
  try {
    const { donorUid, foodItem, quantityKg, expiryTime, location } = req.body;

    const donor = await User.findOne({ uid: donorUid });
    if (!donor || donor.role !== 'donor') {
      return res.status(403).json({ error: 'Unauthorized or invalid user' });
    }

    const newDonation = new Donation({
      donorId: donor._id,
      foodItem,
      quantityKg,
      expiryTime,
      location: location || donor.location
    });

    await newDonation.save();
    await newDonation.populate('donorId', 'name organizationName location phone email');

    req.io.emit('new_donation', newDonation); // Broadcast to receivers
    req.io.emit('donor_listing_created', newDonation); // Real-time notification for donor

    res.status(201).json(newDonation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Request a claim (Receiver requests -> Pending Donor Approval)
router.put('/:id/claim', async (req, res) => {
  try {
    const { receiverUid } = req.body;

    const receiver = await User.findOne({ uid: receiverUid });
    if (!receiver || receiver.role !== 'receiver') {
      return res.status(403).json({ error: 'Unauthorized or invalid user' });
    }

    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (donation.status !== 'available') {
      return res.status(400).json({ error: 'Donation is already claimed or pending approval' });
    }

    if (new Date(donation.expiryTime) < new Date()) {
      return res.status(400).json({ error: 'Donation has expired' });
    }

    // Set status to pending donor approval
    donation.status = 'pending_approval';
    donation.receiverId = receiver._id;
    await donation.save();

    await donation.populate('receiverId', 'name organizationName phone email');
    await donation.populate('donorId', 'name organizationName uid');

    // Broadcast claim request in real-time
    req.io.emit('claim_requested', donation);

    res.status(200).json(donation);
  } catch (error) {
    console.error('Error requesting claim:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Approve a claim (Donor explicitly approves)
router.put('/:id/approve', async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (donation.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Donation is not awaiting approval' });
    }

    donation.status = 'claimed';
    donation.claimedAt = new Date();
    await donation.save();

    await donation.populate('receiverId', 'name organizationName phone email uid');
    await donation.populate('donorId', 'name organizationName uid');

    // Notify receiver and donor
    req.io.emit('claim_approved', donation);
    req.io.emit('donation_claimed', donation);

    res.status(200).json(donation);
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Reject a claim (Donor declines -> restores to available)
router.put('/:id/reject', async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (donation.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Donation is not awaiting approval' });
    }

    const formerReceiver = await User.findById(donation.receiverId);

    // Reset status back to available
    donation.status = 'available';
    donation.receiverId = null;
    await donation.save();

    await donation.populate('donorId', 'name organizationName location phone email');

    // Notify parties
    req.io.emit('claim_rejected', {
      donationId: donation._id,
      receiverUid: formerReceiver?.uid,
      foodItem: donation.foodItem
    });
    req.io.emit('donation_restored', donation);

    res.status(200).json(donation);
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Complete a donation (QR scan handoff)
router.put('/:id/complete', async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (donation.status !== 'claimed') {
      return res.status(400).json({ error: 'Donation is not in claimed state' });
    }

    donation.status = 'completed';
    donation.completedAt = new Date();
    await donation.save();

    await donation.populate('receiverId', 'name organizationName phone email');
    await donation.populate('donorId', 'name organizationName');

    req.io.emit('donation_completed', donation); // Real-time emit

    res.status(200).json(donation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
