const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getUserNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification
} = require('../Controllers/notificationController');

// Get user's notifications
router.get('/', authenticateToken, getUserNotifications);

// Create notification for authenticated user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const notification = await createNotification({
      ...req.body,
      recipientId: req.user._id,
      senderId: req.user._id
    });

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating notification'
    });
  }
});

// Create notification for recipient by account number
router.post('/recipient/:accountNumber', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const recipient = await User.findOne({ bankAccount: req.params.accountNumber });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    const notification = await createNotification({
      ...req.body,
      recipientId: recipient._id,
      senderId: req.user._id
    });

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating notification'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, markAsRead);

// Delete notification
router.delete('/:id', authenticateToken, deleteNotification);

// Clear all notifications
router.delete('/', authenticateToken, clearAllNotifications);

module.exports = router; 