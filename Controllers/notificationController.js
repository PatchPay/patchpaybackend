const Notification = require("../models/Notification");

const createNotification = (data) => {
  return Notification.create(data);
};

const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: {
        recipientId: req.user.id,
      },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching notifications",
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        recipientId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.update({
      isRead: true,
    });

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error marking notification as read",
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        recipientId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.destroy();

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting notification",
    });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    await Notification.destroy({
      where: {
        recipientId: req.user.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "All notifications cleared successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error clearing notifications",
    });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
};