const Notification = require("../models/Notification");

/**
 * Create a notification safely.
 *
 * Notification failures should NEVER break the main business operation.
 * For example, if an invoice is successfully paid, a notification failure
 * must not make the payment endpoint return an error.
 */
const createNotification = async ({
  recipientId,
  senderId = null,
  title,
  message,
  type = "info",
  category = "system",
  metadata = {},
  transaction = null,
}) => {
  if (!recipientId) {
    console.warn("[notification] Missing recipientId");
    return null;
  }

  try {
    const notification = await Notification.create(
      {
        recipientId,
        senderId,
        title,
        message,
        type,
        category,
        metadata,
      },
      transaction ? { transaction } : undefined
    );

    return notification;
  } catch (error) {
    console.error("[notification] Failed to create notification:", {
      message: error.message,
      recipientId,
      title,
      category,
    });

    // Notification failure must not break the main operation.
    return null;
  }
};

module.exports = {
  createNotification,
};