const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { sendFeedbackConfirmation } = require('../services/emailService');

// Submit feedback and send review email to user
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      name,
      email,
      phone,
      organizationName,
      role,
      category,
      rating,
      message
    } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }

    // 1. Create and save feedback document in MongoDB
    const feedback = new Feedback({
      userId: userId || null,
      name,
      email,
      phone: phone || '',
      organizationName: organizationName || '',
      role: role || 'general',
      category: category || 'General',
      rating: Number(rating) || 5,
      message
    });

    await feedback.save();

    // 2. Dispatch confirmation email asynchronously so user gets full copy of their feedback
    const emailResult = await sendFeedbackConfirmation(feedback);

    if (emailResult.success) {
      feedback.emailSent = true;
      if (emailResult.previewUrl) {
        feedback.emailPreviewUrl = emailResult.previewUrl;
      }
      await feedback.save();
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. A confirmation email has been dispatched to your email address.',
      feedback,
      emailSent: feedback.emailSent,
      emailPreviewUrl: feedback.emailPreviewUrl || null
    });
  } catch (error) {
    console.error('Error handling feedback submission:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all feedbacks
router.get('/', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).limit(50);
    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
