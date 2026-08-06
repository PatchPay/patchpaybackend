const express = require("express");
const router = express.Router();

const {
  createNotification,
  getUserNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
} = require("../Controllers/notificationController");

const { authenticateToken } = require("../middlewares/authMiddleware");
const User = require("../models/User");

// Get notifications
router.get("/", authenticateToken, getUserNotifications);

// Create notification
router.post("/", authenticateToken, async (req, res) => {
  try {
    const notification = await createNotification({
      ...req.body,
      senderId: req.user.id,
      recipientId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Notify another user
router.post(
  "/recipient/:accountNumber",
  authenticateToken,
  async (req, res) => {
    try {
      const recipient = await User.findOne({
        where: {
          bankAccount: req.params.accountNumber,
        },
      });

      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: "Recipient not found",
        });
      }

      const notification = await createNotification({
        ...req.body,
        senderId: req.user.id,
        recipientId: recipient.id,
      });

      res.status(201).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.patch("/:id/read", authenticateToken, markAsRead);

router.delete("/:id", authenticateToken, deleteNotification);

router.delete("/", authenticateToken, clearAllNotifications);

module.exports = router;