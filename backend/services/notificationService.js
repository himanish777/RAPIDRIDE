import Notification from '../models/Notification.js';
import logger from '../config/logger.js';
import { getSocketInstance } from '../config/socketHelper.js';

/**
 * Notification Service - Handles creation and management of notifications
 */
class NotificationService {
  
  // ===== NOTIFICATION TEMPLATES =====
  
  static TEMPLATES = {
    // Rider notifications
    ride_request_sent: {
      title: '🚗 Ride Request Sent',
      message: 'Searching for nearby drivers...',
      icon: '🔍',
      priority: 'medium'
    },
    driver_accepted: {
      title: '✅ Driver Accepted',
      message: 'Your driver is on the way!',
      icon: '✅',
      priority: 'high'
    },
    driver_declined: {
      title: '❌ Ride Not Available',
      message: 'No drivers available. Try again.',
      icon: '❌',
      priority: 'medium'
    },
    driver_on_way: {
      title: '🚙 Driver On The Way',
      message: 'Your driver is heading to your pickup location',
      icon: '🚙',
      priority: 'high'
    },
    driver_nearby: {
      title: '📍 Driver Nearby',
      message: 'Your driver is close to your pickup location',
      icon: '📍',
      priority: 'high'
    },
    driver_arrived: {
      title: '🎯 Driver Arrived',
      message: 'Your driver has arrived at the pickup location',
      icon: '🎯',
      priority: 'urgent'
    },
    trip_started: {
      title: '🛣️ Trip Started',
      message: 'Have a safe journey!',
      icon: '🛣️',
      priority: 'high'
    },
    trip_ended: {
      title: '✅ Trip Completed',
      message: 'Thank you for riding with us!',
      icon: '🎉',
      priority: 'high'
    },
    driver_cancelled: {
      title: '❌ Driver Cancelled',
      message: 'Your driver cancelled the trip. Finding another driver...',
      icon: '❌',
      priority: 'urgent'
    },
    payment_success: {
      title: '💳 Payment Successful',
      message: 'Your payment has been processed',
      icon: '💰',
      priority: 'medium'
    },
    payment_failed: {
      title: '❌ Payment Failed',
      message: 'Please update your payment method',
      icon: '⚠️',
      priority: 'urgent'
    },
    autopay_charged: {
      title: '💳 Auto-Pay Charged',
      message: 'Your payment was automatically processed',
      icon: '💳',
      priority: 'low'
    },
    refund_initiated: {
      title: '💰 Refund Initiated',
      message: 'Your refund is being processed',
      icon: '💰',
      priority: 'medium'
    },
    promo_available: {
      title: '🎁 Promo Code Available',
      message: 'You have a new promo code!',
      icon: '🎁',
      priority: 'low'
    },
    
    // Driver notifications
    new_ride_request: {
      title: '🚨 New Ride Request',
      message: 'You have a new ride request nearby',
      icon: '🚨',
      priority: 'urgent'
    },
    ride_timeout_warning: {
      title: '⏰ Request Expiring Soon',
      message: 'This ride request will expire in 10 seconds',
      icon: '⏰',
      priority: 'urgent'
    },
    rider_cancelled: {
      title: '❌ Rider Cancelled',
      message: 'The rider cancelled this trip',
      icon: '❌',
      priority: 'high'
    },
    ride_accepted_success: {
      title: '✅ Ride Accepted',
      message: 'Navigate to the pickup location',
      icon: '✅',
      priority: 'high'
    },
    trip_start_reminder: {
      title: '🔔 Start Trip Reminder',
      message: 'Remember to start the trip when rider boards',
      icon: '🔔',
      priority: 'medium'
    },
    trip_ended_success: {
      title: '🎉 Trip Completed',
      message: 'Great job! Trip completed successfully',
      icon: '🎉',
      priority: 'high'
    },
    cash_collect: {
      title: '💵 Collect Cash',
      message: 'Please collect cash payment from rider',
      icon: '💵',
      priority: 'urgent'
    },
    payment_received: {
      title: '💰 Payment Received',
      message: 'Payment has been credited to your account',
      icon: '💰',
      priority: 'medium'
    },
    weekly_earnings: {
      title: '📊 Weekly Earnings Summary',
      message: 'Check out your earnings this week!',
      icon: '📊',
      priority: 'low'
    },
    incentive_available: {
      title: '🎁 Incentive Available',
      message: 'You have earned a bonus!',
      icon: '🎁',
      priority: 'medium'
    },
    surge_active: {
      title: '🔥 Peak Demand Active',
      message: 'Surge pricing active in your area - earn more!',
      icon: '🔥',
      priority: 'high'
    }
  };

  /**
   * Create a notification
   */
  static async createNotification({ userId, userModel, type, customTitle, customMessage, metadata = {}, priority, icon, actionUrl, expiresAt }) {
    try {
      const template = this.TEMPLATES[type] || {};
      const notification = await Notification.create({
        userId,
        userModel,
        type,
        title: customTitle || template.title || 'Notification',
        message: customMessage || template.message || '',
        metadata,
        priority: priority || template.priority || 'medium',
        icon: icon || template.icon || '🔔',
        actionUrl,
        expiresAt
      });

      // DEBUG: Log notification creation to console
      console.log('[NotificationService] Notification created:', {
        notificationId: notification._id,
        userId,
        type,
        title: notification.title,
        message: notification.message
      });

      logger.info('Notification created', { 
        notificationId: notification._id, 
        userId, 
        type 
      });

      // Emit real-time notification via socket
      this.emitNotification(userId, notification);

      return { success: true, notification };
    } catch (error) {
      logger.error('Error creating notification', { 
        error: error.message, 
        userId, 
        type 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = { userId };
      
      if (unreadOnly) {
        query.isRead = false;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.getUnreadCount(userId);

      return {
        success: true,
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      };
    } catch (error) {
      logger.error('Error fetching notifications', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({ 
        _id: notificationId, 
        userId 
      });

      if (!notification) {
        return { success: false, message: 'Notification not found' };
      }

      await notification.markAsRead();

      // Emit update via socket
      this.emitNotificationUpdate(userId, { notificationId, isRead: true });

      return { success: true, notification };
    } catch (error) {
      logger.error('Error marking notification as read', { 
        error: error.message, 
        notificationId 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      const count = await Notification.markAllAsRead(userId);

      // Emit update via socket
      this.emitNotificationUpdate(userId, { allRead: true });

      return { success: true, count };
    } catch (error) {
      logger.error('Error marking all as read', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({ 
        _id: notificationId, 
        userId 
      });

      if (result.deletedCount === 0) {
        return { success: false, message: 'Notification not found' };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error deleting notification', { 
        error: error.message, 
        notificationId 
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.getUnreadCount(userId);
      return { success: true, count };
    } catch (error) {
      logger.error('Error getting unread count', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete all notifications for a user
   */
  static async clearAllNotifications(userId) {
    try {
      const result = await Notification.deleteMany({ userId });
      return { success: true, count: result.deletedCount };
    } catch (error) {
      logger.error('Error clearing notifications', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  // ===== SOCKET HELPERS =====

  /**
   * Emit notification to user via socket
   */
  static emitNotification(userId, notification) {
    try {
      const io = getSocketInstance();
      if (io) {
        io.to(`user_${userId}`).emit('new_notification', {
          notification: {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            icon: notification.icon,
            priority: notification.priority,
            metadata: notification.metadata,
            actionUrl: notification.actionUrl,
            isRead: notification.isRead,
            createdAt: notification.createdAt
          }
        });
        console.log(`📢 Notification emitted to user_${userId}:`, notification.title);
      }
    } catch (error) {
      logger.error('Error emitting notification', { error: error.message, userId });
    }
  }

  /**
   * Emit notification update (e.g., marked as read)
   */
  static emitNotificationUpdate(userId, updateData) {
    try {
      const io = getSocketInstance();
      if (io) {
        io.to(`user_${userId}`).emit('notification_update', updateData);
      }
    } catch (error) {
      logger.error('Error emitting notification update', { 
        error: error.message, 
        userId 
      });
    }
  }

  // ===== RIDER-SPECIFIC NOTIFICATIONS =====

  static async notifyRideRequestSent(riderId, rideId) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'ride_request_sent',
      metadata: { rideId }
    });
  }

  static async notifyDriverAccepted(riderId, rideId, driverName) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_accepted',
      customMessage: `${driverName} accepted your ride!`,
      metadata: { rideId, driverName }
    });
  }

  static async notifyDriverDeclined(riderId, rideId) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_declined',
      metadata: { rideId }
    });
  }

  static async notifyDriverOnWay(riderId, rideId, driverName, eta) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_on_way',
      customMessage: `${driverName} is on the way. ETA: ${eta} mins`,
      metadata: { rideId, driverName, eta }
    });
  }

  static async notifyDriverNearby(riderId, rideId, driverName) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_nearby',
      customMessage: `${driverName} is nearby`,
      metadata: { rideId, driverName }
    });
  }

  static async notifyDriverArrived(riderId, rideId, driverName) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_arrived',
      customMessage: `${driverName} has arrived`,
      metadata: { rideId, driverName }
    });
  }

  static async notifyTripStarted(riderId, rideId) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'trip_started',
      metadata: { rideId }
    });
  }

  static async notifyTripEnded(riderId, rideId, fare) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'trip_ended',
      customMessage: `Trip completed. Fare: ₹${fare}`,
      metadata: { rideId, fare }
    });
  }

  static async notifyDriverCancelled(riderId, rideId, driverName) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'driver_cancelled',
      customMessage: `${driverName} cancelled your trip`,
      metadata: { rideId, driverName }
    });
  }

  static async notifyPaymentSuccess(riderId, rideId, amount) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'payment_success',
      customMessage: `Payment of ₹${amount} successful`,
      metadata: { rideId, amount }
    });
  }

  static async notifyPaymentFailed(riderId, rideId, amount) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'payment_failed',
      customMessage: `Payment of ₹${amount} failed`,
      metadata: { rideId, amount },
      priority: 'urgent'
    });
  }

  static async notifyAutoPayCharged(riderId, amount) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'autopay_charged',
      customMessage: `₹${amount} charged via Auto-Pay`,
      metadata: { amount }
    });
  }

  static async notifyRefundInitiated(riderId, rideId, amount) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'refund_initiated',
      customMessage: `Refund of ₹${amount} initiated`,
      metadata: { rideId, amount }
    });
  }

  static async notifyPromoAvailable(riderId, promoCode, discount) {
    return await this.createNotification({
      userId: riderId,
      userModel: 'Rider',
      type: 'promo_available',
      customMessage: `Use code ${promoCode} for ${discount}% off!`,
      metadata: { promoCode, discount }
    });
  }

  // ===== DRIVER-SPECIFIC NOTIFICATIONS =====

  static async notifyNewRideRequest(driverId, rideId, pickupLocation, distance) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'new_ride_request',
      customMessage: `New ride from ${pickupLocation} (${distance} km away)`,
      metadata: { rideId, pickupLocation, distance },
      expiresAt: new Date(Date.now() + 30000) // 30 seconds
    });
  }

  static async notifyRideTimeoutWarning(driverId, rideId) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'ride_timeout_warning',
      metadata: { rideId }
    });
  }

  static async notifyRiderCancelled(driverId, rideId) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'rider_cancelled',
      metadata: { rideId }
    });
  }

  static async notifyRideAcceptedSuccess(driverId, rideId, pickupLocation) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'ride_accepted_success',
      customMessage: `Ride accepted. Navigate to ${pickupLocation}`,
      metadata: { rideId, pickupLocation }
    });
  }

  static async notifyTripStartReminder(driverId, rideId) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'trip_start_reminder',
      metadata: { rideId }
    });
  }

  static async notifyTripEndedSuccess(driverId, rideId, earnings) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'trip_ended_success',
      customMessage: `Trip completed. You earned ₹${earnings}`,
      metadata: { rideId, earnings }
    });
  }

  static async notifyCashCollect(driverId, rideId, amount) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'cash_collect',
      customMessage: `Collect ₹${amount} cash from rider`,
      metadata: { rideId, amount }
    });
  }

  static async notifyPaymentReceived(driverId, amount, rideId) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'payment_received',
      customMessage: `₹${amount} credited to your account`,
      metadata: { amount, rideId }
    });
  }

  static async notifyWeeklyEarnings(driverId, totalEarnings, tripCount) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'weekly_earnings',
      customMessage: `You earned ₹${totalEarnings} from ${tripCount} trips this week!`,
      metadata: { totalEarnings, tripCount }
    });
  }

  static async notifyIncentiveAvailable(driverId, incentiveAmount, reason) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'incentive_available',
      customMessage: `You earned ₹${incentiveAmount} bonus for ${reason}!`,
      metadata: { incentiveAmount, reason }
    });
  }

  static async notifySurgeActive(driverId, area, surgeMultiplier) {
    return await this.createNotification({
      userId: driverId,
      userModel: 'Driver',
      type: 'surge_active',
      customMessage: `${surgeMultiplier}x surge in ${area}!`,
      metadata: { area, surgeMultiplier }
    });
  }
}

export default NotificationService;
