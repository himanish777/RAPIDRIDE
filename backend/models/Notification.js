import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // User info
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Rider', 'Driver', 'Admin']
  },
  
  // Notification details
  type: {
    type: String,
    required: true,
    enum: [
      // Rider notifications
      'ride_request_sent',
      'driver_accepted',
      'driver_declined',
      'driver_on_way',
      'driver_nearby',
      'driver_arrived',
      'trip_started',
      'trip_ended',
      'driver_cancelled',
      'payment_success',
      'payment_failed',
      'autopay_charged',
      'refund_initiated',
      'promo_available',
      
      // Driver notifications
      'new_ride_request',
      'ride_timeout_warning',
      'rider_cancelled',
      'ride_accepted_success',
      'trip_start_reminder',
      'trip_ended_success',
      'cash_collect',
      'payment_received',
      'weekly_earnings',
      'incentive_available',
      'surge_active',
      
      // Common
      'system_message',
      'sos_alert',
      'general'
    ]
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Additional data (ride ID, amount, etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: {
    type: Date
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Icon for UI
  icon: {
    type: String,
    default: '🔔'
  },
  
  // Action link (optional)
  actionUrl: {
    type: String
  },
  
  // Expiry (for time-sensitive notifications)
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ userId, isRead: false });
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  const result = await this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount;
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
