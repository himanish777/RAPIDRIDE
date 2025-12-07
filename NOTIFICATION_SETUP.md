# Notification System - Quick Setup Guide

## Setup Instructions

### 1. No Additional Dependencies Required
The notification system uses existing dependencies:
- MongoDB (for storing notifications)
- Socket.IO (already configured)
- Express (for API routes)

### 2. Database Migration
The Notification model will automatically create the collection on first use. No migration needed.

### 3. Frontend Integration

#### For Rider Dashboard
In `frontend/rider/pages/dashboard.html` or relevant pages, ensure you initialize the NotificationManager:

```javascript
import { NotificationManager } from '../assets/js/notifications.js';
import { SocketManager } from '../assets/js/socket.js';

// Initialize socket
const socketManager = new SocketManager();
socketManager.connect();

// Initialize notifications with socket
const notificationManager = new NotificationManager(socketManager.socket);

// Request browser notification permission (optional, improves UX)
notificationManager.requestPermission();
```

#### For Driver Dashboard
In `frontend/driver/pages/dashboard.html` or relevant pages:

```javascript
import { NotificationManager } from '../assets/js/notifications.js';
// Assuming you have socket initialized
const notificationManager = new NotificationManager(socket);
notificationManager.requestPermission();
```

### 4. Testing the System

#### Test 1: New Ride Request
```bash
# Start the backend server
cd backend
npm start

# Open rider frontend and request a ride
# Check:
# - Rider receives "Ride request sent" notification
# - Available drivers receive "New ride request" notification
```

#### Test 2: Driver Accepts Ride
```bash
# Have a driver accept the ride
# Check:
# - Driver receives "Ride accepted successfully" notification
# - Rider receives "Driver accepted your ride" notification
```

#### Test 3: Ride Status Updates
```bash
# Update ride status to 'arriving', 'waiting', 'on_trip', 'completed'
# Check:
# - Rider receives appropriate notifications at each stage
# - Driver receives completion notification
```

#### Test 4: API Endpoints
```bash
# Get notifications (replace TOKEN with actual JWT token)
curl -H "Authorization: Bearer TOKEN" http://localhost:5500/api/notifications

# Get unread count
curl -H "Authorization: Bearer TOKEN" http://localhost:5500/api/notifications/unread-count

# Mark notification as read (replace NOTIFICATION_ID)
curl -X PUT -H "Authorization: Bearer TOKEN" http://localhost:5500/api/notifications/NOTIFICATION_ID/read

# Mark all as read
curl -X PUT -H "Authorization: Bearer TOKEN" http://localhost:5500/api/notifications/mark-all-read
```

### 5. Verify Socket.IO Connection

Open browser console and look for:
```
✅ Socket connected: <socket-id>
✅ User <user-id> subscribed to notifications
```

### 6. UI Elements Required

Ensure your HTML has these elements for notifications to display:

```html
<!-- Notification badge (usually in header) -->
<span class="notification-badge" style="display: none;">0</span>

<!-- Notification panel (dropdown or modal) -->
<div class="notification-list">
  <!-- Notifications will be inserted here -->
</div>

<!-- Mark all as read button (optional) -->
<button onclick="notificationManager.markAllAsRead()">Mark All Read</button>
```

## Troubleshooting

### Notifications Not Appearing
1. Check browser console for Socket.IO connection
2. Verify JWT token is present in localStorage
3. Check backend logs for notification creation
4. Ensure `user:subscribe` event is emitted

### Socket Not Connecting
1. Verify backend server is running
2. Check CORS settings in `backend/server.js`
3. Check browser console for connection errors

### API Returns 401 Unauthorized
1. Verify token is in Authorization header
2. Check token hasn't expired
3. Verify authMiddleware is working

### Notifications Not Persisting
1. Check MongoDB connection
2. Verify Notification model is imported
3. Check database for `notifications` collection

## Production Considerations

1. **Environment Variables**
   - Set appropriate `FRONTEND_URL` in .env
   - Configure Socket.IO CORS for production domain

2. **Database Indexes**
   - Notification model includes indexes, ensure they're created:
   ```bash
   # In MongoDB shell
   db.notifications.getIndexes()
   ```

3. **Performance**
   - Consider adding pagination limits
   - Implement notification cleanup for old read notifications
   - Use Redis for caching unread counts (optional)

4. **Monitoring**
   - Monitor notification delivery rates
   - Track socket disconnections
   - Log notification failures

## Testing Checklist

- [ ] Backend server starts without errors
- [ ] Notification routes are accessible
- [ ] Socket.IO connects successfully
- [ ] User subscription to notification room works
- [ ] Notifications are created in database
- [ ] Notifications are delivered via Socket.IO
- [ ] Frontend displays notifications in toast
- [ ] Notification panel updates correctly
- [ ] Badge count updates correctly
- [ ] Mark as read functionality works
- [ ] Browser notifications appear (after permission)
- [ ] API endpoints return correct data
- [ ] Rider notifications work for all scenarios
- [ ] Driver notifications work for all scenarios

## Next Steps

1. Test the notification system thoroughly
2. Customize notification templates in `NotificationService.TEMPLATES`
3. Add custom notification sounds (place audio files in `/assets/sounds/`)
4. Implement additional notification types as needed
5. Add email/SMS fallback for critical notifications

## Support

Refer to `NOTIFICATION_SYSTEM_README.md` for detailed documentation.
