import express from 'express';
import NotificationService from '../services/notificationService.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, unreadOnly } = req.query;

    const result = await NotificationService.getNotifications(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true'
    });

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await NotificationService.getUnreadCount(userId);

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    const result = await NotificationService.markAsRead(notificationId, userId);

    if (!result.success) {
      return res.status(404).json({ message: result.message || result.error });
    }

    res.json({ message: 'Notification marked as read', notification: result.notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await NotificationService.markAllAsRead(userId);

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({ message: 'All notifications marked as read', count: result.count });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    const result = await NotificationService.deleteNotification(notificationId, userId);

    if (!result.success) {
      return res.status(404).json({ message: result.message || result.error });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/notifications
 * @desc    Clear all notifications for user
 * @access  Private
 */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await NotificationService.clearAllNotifications(userId);

    if (!result.success) {
      return res.status(500).json({ message: result.error });
    }

    res.json({ message: 'All notifications cleared', count: result.count });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
