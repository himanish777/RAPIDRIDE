// Notifications Module for Drivers - Manages in-app notifications
export class NotificationManager {
  constructor(socket = null) {
    this.notifications = [];
    this.maxNotifications = 50;
    this.socket = socket;
    this.apiUrl = window.location.origin;
    this.token = localStorage.getItem('rapidride_token');
    
    // Initialize
    if (this.socket) {
      this.setupSocketListeners();
    }
    this.fetchNotifications();
  }
  
  // Setup socket listeners for real-time notifications
  setupSocketListeners() {
    if (!this.socket) return;
    
    // Subscribe user to notification room
    const userData = this.getUserData();
    if (userData && userData.id) {
      this.socket.emit('user:subscribe', { userId: userData.id });
    }
    
    // Listen for new notifications
    this.socket.on('new_notification', (data) => {
      console.log('📢 New notification received:', data);
      if (data.notification) {
        this.addNotification(data.notification);
        
        // Play sound for urgent notifications (new ride requests)
        if (data.notification.type === 'new_ride_request') {
          this.playNotificationSound();
        }
      }
    });
    
    // Listen for notification updates
    this.socket.on('notification_update', (data) => {
      console.log('🔄 Notification update:', data);
      if (data.allRead) {
        this.notifications.forEach(n => n.isRead = true);
        this.updateNotificationPanel();
        this.updateNotificationBadge();
      }
    });
  }
  
  // Get user data from localStorage
  getUserData() {
    const driverData = localStorage.getItem('rapidride_driver');
    if (driverData) {
      return JSON.parse(driverData);
    }
    return null;
  }
  
  // Fetch notifications from API
  async fetchNotifications() {
    if (!this.token) return;
    
    try {
      const response = await fetch(`${this.apiUrl}/api/notifications?limit=50`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.notifications) {
          this.notifications = data.notifications.map(n => ({
            id: n._id,
            title: n.title,
            message: n.message,
            icon: n.icon,
            isRead: n.isRead,
            timestamp: n.createdAt,
            metadata: n.metadata,
            type: n.type
          }));
          this.updateNotificationPanel();
          this.updateNotificationBadge();
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }
  
  // Mark notification as read via API
  async markAsReadAPI(notificationId) {
    if (!this.token) return;
    
    try {
      await fetch(`${this.apiUrl}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
  
  // Mark all as read via API
  async markAllAsReadAPI() {
    if (!this.token) return;
    
    try {
      await fetch(`${this.apiUrl}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  // Show toast notification
  show(message, type = 'info', duration = 3000) {
    const toast = this.createToast(message, type);
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Auto remove
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  // Create toast element
  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = this.getIcon(type);
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">✕</button>
    `;

    // Add close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast);
    });

    return toast;
  }

  // Get icon based on type
  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  // Remove toast
  removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Add notification to panel
  addNotification(notificationData) {
    // Normalize notification data
    const notification = {
      id: notificationData.id || notificationData._id || Date.now(),
      title: notificationData.title,
      message: notificationData.message,
      icon: notificationData.icon || '🔔',
      isRead: notificationData.isRead || false,
      timestamp: notificationData.timestamp || notificationData.createdAt || new Date(),
      metadata: notificationData.metadata || {},
      priority: notificationData.priority || 'medium',
      type: notificationData.type
    };
    
    this.notifications.unshift(notification);
    
    // Limit notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    this.updateNotificationPanel();
    this.updateNotificationBadge();

    // Show toast for new notification with priority-based type
    const toastType = this.getToastType(notification.priority);
    this.show(notificationData.title, toastType, 5000); // Longer duration for drivers
    
    // Try browser notification if permission granted
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      this.showBrowserNotification(notification.title, {
        body: notification.message,
        icon: '/assets/images/logo.png',
        requireInteraction: notification.type === 'new_ride_request'
      });
    }
  }
  
  // Get toast type based on priority
  getToastType(priority) {
    const typeMap = {
      urgent: 'error',
      high: 'warning',
      medium: 'info',
      low: 'info'
    };
    return typeMap[priority] || 'info';
  }

  // Update notification panel
  updateNotificationPanel() {
    const notificationList = document.querySelector('.notification-list');
    if (!notificationList) return;

    notificationList.innerHTML = '';

    this.notifications.forEach(notification => {
      const item = this.createNotificationItem(notification);
      notificationList.appendChild(item);
    });
  }

  // Create notification item
  createNotificationItem(notification) {
    const item = document.createElement('div');
    const isRead = notification.isRead || notification.read;
    item.className = `notification-item ${isRead ? '' : 'unread'}`;
    
    const icon = notification.icon || '📢';
    const timeAgo = this.getTimeAgo(notification.timestamp);

    item.innerHTML = `
      <span class="notif-icon">${icon}</span>
      <div class="notif-content">
        <p class="notif-title">${notification.title}</p>
        <p class="notif-text">${notification.message}</p>
        <span class="notif-time">${timeAgo}</span>
      </div>
    `;

    // Mark as read when clicked
    item.addEventListener('click', () => {
      this.markAsRead(notification.id);
      item.classList.remove('unread');
    });

    return item;
  }

  // Calculate time ago
  getTimeAgo(timestamp) {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  // Mark notification as read
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      notification.read = true; // backward compatibility
      this.updateNotificationBadge();
      this.markAsReadAPI(notificationId);
    }
  }

  // Mark all as read
  markAllAsRead() {
    this.notifications.forEach(n => {
      n.isRead = true;
      n.read = true; // backward compatibility
    });
    this.updateNotificationBadge();
    this.updateNotificationPanel();
    this.markAllAsReadAPI();
  }

  // Update notification badge count
  updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (!badge) return;

    const unreadCount = this.notifications.filter(n => !n.isRead && !n.read).length;
    
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Get all notifications
  getAll() {
    return this.notifications;
  }

  // Get unread notifications
  getUnread() {
    return this.notifications.filter(n => !n.isRead && !n.read);
  }

  // Clear all notifications
  clearAll() {
    this.notifications = [];
    this.updateNotificationPanel();
    this.updateNotificationBadge();
  }

  // Request browser notification permission
  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // Show browser notification
  showBrowserNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/assets/images/logo.png',
        badge: '/assets/images/badge.png',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }
  
  // Play notification sound (for new ride requests)
  playNotificationSound() {
    try {
      const audio = new Audio('/assets/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Could not play sound:', err));
    } catch (error) {
      console.log('Sound not available');
    }
  }
}

// Add toast styles dynamically
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .toast {
    position: fixed;
    bottom: -100px;
    right: 30px;
    background: white;
    border-radius: 10px;
    padding: 15px 20px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    max-width: 400px;
    z-index: 10000;
    transition: all 0.3s ease;
    border-left: 4px solid #2E4053;
  }

  .toast.show {
    bottom: 30px;
  }

  .toast-icon {
    font-size: 24px;
  }

  .toast-message {
    flex: 1;
    font-size: 14px;
    color: #2E4053;
    font-weight: 600;
  }

  .toast-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
  }

  .toast-close:hover {
    color: #2E4053;
  }

  .toast-success {
    border-left-color: #27ae60;
  }

  .toast-error {
    border-left-color: #e74c3c;
  }

  .toast-warning {
    border-left-color: #f39c12;
  }

  .toast-info {
    border-left-color: #3498db;
  }

  @media (max-width: 480px) {
    .toast {
      right: 15px;
      left: 15px;
      min-width: auto;
    }

    .toast.show {
      bottom: 15px;
    }
  }
`;

document.head.appendChild(toastStyles);

export default NotificationManager;
