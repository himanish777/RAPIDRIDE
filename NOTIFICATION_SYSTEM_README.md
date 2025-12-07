# RapidRide Notification System

## Overview
Comprehensive notification system implemented for both riders and drivers with real-time Socket.IO updates, persistent database storage, and browser notifications.

## Features Implemented

### Backend Components

#### 1. Notification Model (`backend/models/Notification.js`)
- MongoDB schema with support for riders, drivers, and admins
- 25+ notification types covering all use cases
- Fields: type, title, message, metadata, priority, icon, read status, expiry
- Auto-expiry for time-sensitive notifications
- Indexes for performance optimization

#### 2. Notification Service (`backend/services/notificationService.js`)
- Centralized service for creating and managing notifications
- Pre-defined templates for all notification types
- Socket.IO integration for real-time delivery
- Static methods for each notification scenario

#### 3. Notification Routes (`backend/routes/notificationRoutes.js`)
API Endpoints:
- `GET /api/notifications` - Fetch user notifications (paginated)
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete a notification
- `DELETE /api/notifications` - Clear all notifications

#### 4. Socket.IO Integration (`backend/server.js`)
- User room subscription: `user:subscribe`
- Real-time notification delivery via `new_notification` event
- Notification updates via `notification_update` event

### Frontend Components

#### 1. Rider Notifications (`frontend/rider/assets/js/notifications.js`)
- NotificationManager class with Socket.IO integration
- Automatic API fetching on initialization
- Real-time notification reception
- Toast notifications with priority-based styling
- Browser notifications for high-priority alerts
- Notification panel with read/unread status
- Badge counter for unread notifications

#### 2. Driver Notifications (`frontend/driver/assets/js/notifications.js`)
- Same features as rider notifications
- Additional notification sound for new ride requests
- Longer toast duration (5 seconds) for important alerts
- requireInteraction for urgent ride requests

## Notification Types

### RIDER NOTIFICATIONS ✅

#### Ride Request & Status
1. **ride_request_sent** - Ride request sent, searching for drivers
2. **driver_accepted** - Driver accepted your ride
3. **driver_declined** - No drivers available
4. **driver_on_way** - Driver is heading to pickup location
5. **driver_nearby** - Driver is close to pickup
6. **driver_arrived** - Driver has arrived at pickup
7. **trip_started** - Trip has started
8. **trip_ended** - Trip completed
9. **driver_cancelled** - Driver cancelled the trip

#### Payments
10. **payment_success** - Payment processed successfully
11. **payment_failed** - Payment failed, update payment method
12. **autopay_charged** - Auto-pay charged
13. **refund_initiated** - Refund is being processed
14. **promo_available** - New promo code available

### DRIVER NOTIFICATIONS ✅

#### Ride Requests
1. **new_ride_request** - New ride request nearby (with sound alert)
2. **ride_timeout_warning** - Request expiring in 10 seconds
3. **rider_cancelled** - Rider cancelled the trip
4. **ride_accepted_success** - Ride accepted, navigate to pickup
5. **trip_start_reminder** - Reminder to start trip
6. **trip_ended_success** - Trip completed successfully

#### Earnings & Payments
7. **cash_collect** - Collect cash from rider
8. **payment_received** - Payment credited to account
9. **weekly_earnings** - Weekly earnings summary
10. **incentive_available** - Bonus earned
11. **surge_active** - Peak demand active in area

## Integration Points

### Service Integration

#### RiderService (`backend/services/riderService.js`)
- ✅ Notification on ride request sent
- ✅ Notification to nearby drivers for new requests
- ✅ Notification to driver when rider cancels

#### DriverService (`backend/services/driverService.js`)
- ✅ Notification to rider when driver accepts
- ✅ Notification to driver on successful acceptance
- ✅ Notification to rider on status changes (arriving, arrived)
- ✅ Notification to rider on trip start
- ✅ Notification to both on trip completion
- ✅ Notification to rider when driver cancels
- ✅ Cash collection notification to driver

## Usage Examples

### Backend - Creating Notifications

```javascript
import NotificationService from './services/notificationService.js';

// Notify rider that driver accepted
await NotificationService.notifyDriverAccepted(
  riderId, 
  rideId, 
  driverName
);

// Notify driver of new ride request
await NotificationService.notifyNewRideRequest(
  driverId, 
  rideId, 
  pickupLocation,
  distance
);

// Custom notification
await NotificationService.createNotification({
  userId: userId,
  userModel: 'Rider',
  type: 'payment_success',
  customTitle: 'Payment Successful',
  customMessage: 'Your payment of ₹150 was processed',
  metadata: { amount: 150, rideId },
  priority: 'medium'
});
```

### Frontend - Initializing Notifications

#### Rider Dashboard
```javascript
import { NotificationManager } from './notifications.js';
import { SocketManager } from './socket.js';

const socketManager = new SocketManager();
socketManager.connect();

const notificationManager = new NotificationManager(socketManager.socket);

// Request browser notification permission
await notificationManager.requestPermission();
```

#### Driver Dashboard
```javascript
import { NotificationManager } from './notifications.js';

// Pass socket instance to enable real-time notifications
const notificationManager = new NotificationManager(socket);

// Listen for new ride requests with sound alerts
```

## Database Schema

```javascript
{
  userId: ObjectId,              // Reference to Rider/Driver/Admin
  userModel: String,             // 'Rider', 'Driver', or 'Admin'
  type: String,                  // Notification type
  title: String,                 // Notification title
  message: String,               // Notification message
  metadata: Object,              // Additional data (rideId, amount, etc.)
  isRead: Boolean,               // Read status
  readAt: Date,                  // When notification was read
  priority: String,              // 'low', 'medium', 'high', 'urgent'
  icon: String,                  // Emoji icon
  actionUrl: String,             // Optional action URL
  expiresAt: Date,               // Auto-expiry timestamp
  createdAt: Date,
  updatedAt: Date
}
```

## API Response Format

```javascript
{
  "success": true,
  "notifications": [...],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  },
  "unreadCount": 12
}
```

## Socket Events

### Emitted by Backend
- `new_notification` - New notification created
- `notification_update` - Notification status updated

### Emitted by Frontend
- `user:subscribe` - Subscribe to user notification room

## Testing Checklist

- [ ] Rider receives notification when ride request is sent
- [ ] Drivers receive notification for new ride requests
- [ ] Rider receives notification when driver accepts
- [ ] Driver receives notification on successful acceptance
- [ ] Rider receives notifications for driver status (on way, nearby, arrived)
- [ ] Both receive notifications on trip start/end
- [ ] Payment notifications work correctly
- [ ] Cancellation notifications work for both parties
- [ ] Real-time notifications via Socket.IO work
- [ ] Browser notifications appear for urgent alerts
- [ ] Notification badge updates correctly
- [ ] Mark as read functionality works
- [ ] Notification panel displays correctly
- [ ] API endpoints return correct data
- [ ] Pagination works correctly

## Future Enhancements

1. **Email Notifications** - Already integrated via EmailService
2. **SMS Notifications** - Add Twilio integration
3. **Push Notifications** - Add Firebase Cloud Messaging
4. **Notification Preferences** - Let users customize notification types
5. **Notification Sounds** - Custom sounds for different notification types
6. **Action Buttons** - Quick actions in notifications (Accept, Decline, etc.)
7. **Rich Notifications** - Images, maps, and interactive elements
8. **Notification History Filters** - Filter by type, date, read status
9. **Notification Analytics** - Track open rates, engagement

## Notes

- All notification triggers are non-blocking (async without await in non-critical paths)
- Notifications persist in database even after socket disconnection
- Auto-expiry handles time-sensitive notifications (e.g., ride requests)
- Browser notifications require user permission
- Toast notifications auto-dismiss after 3-5 seconds
- Notification priority determines visual styling and behavior
- Icons are emojis for cross-platform compatibility

## Files Modified/Created

### Backend
- ✅ `backend/models/Notification.js` (NEW)
- ✅ `backend/services/notificationService.js` (NEW)
- ✅ `backend/routes/notificationRoutes.js` (NEW)
- ✅ `backend/services/riderService.js` (MODIFIED)
- ✅ `backend/services/driverService.js` (MODIFIED)
- ✅ `backend/app.js` (MODIFIED - added notification routes)
- ✅ `backend/server.js` (MODIFIED - added user room subscription)

### Frontend
- ✅ `frontend/rider/assets/js/notifications.js` (MODIFIED)
- ✅ `frontend/driver/assets/js/notifications.js` (NEW)

## Support

For issues or questions about the notification system, refer to:
- Notification Service: `backend/services/notificationService.js`
- API Documentation: This README
- Socket Events: `backend/server.js`
