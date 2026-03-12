const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a new notification
const createNotification = async (data) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get notifications for a user
const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      recipientId: req.user._id 
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching notifications'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.id,
        recipientId: req.user._id
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error marking notification as read'
    });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting notification'
    });
  }
};

// Clear all notifications for a user
const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipientId: req.user._id });

    res.status(200).json({
      success: true,
      message: 'All notifications cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error clearing notifications'
    });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications
}; 