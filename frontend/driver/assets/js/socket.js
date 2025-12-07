// Socket.IO Module for Driver - Real-time ride notifications
export class DriverSocketManager {
  constructor() {
    this.socket = null;
    this.serverURL = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'http://localhost:5500';
    this.token = localStorage.getItem('rapidride_token') || localStorage.getItem('token');
    this.driverId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.rideRequestHandlers = [];
    this.currentRideRequest = null;
  }

  // Connect to Socket.IO server
  connect(driverId) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.driverId = driverId;

    try {
      const url = (typeof window !== 'undefined' && window.location && window.location.origin) 
        ? window.location.origin 
        : this.serverURL;
      
      console.log('Attempting socket connection to', url);
      this.socket = io(url, {
        auth: {
          token: this.token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts
      });

      this.setupEventHandlers();
      console.log('🔌 Driver socket connecting...');
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  // Setup socket event handlers
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Driver socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      
      // Subscribe to ride requests
      this.subscribeToRideRequests();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.showNotification('Connection lost. Please refresh.', 'error');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected, try reconnecting
        this.socket.connect();
      }
    });

    // Ride request event
    this.socket.on('ride:newRequest', (rideData) => {
      console.log('🚗 New ride request received:', rideData);
      this.handleRideRequest(rideData);
    });

    // Ride cancelled by rider
    this.socket.on('ride:cancelled', (data) => {
      console.log('❌ Ride cancelled:', data);
      if (this.currentRideRequest && this.currentRideRequest.rideId === data.rideId) {
        this.currentRideRequest = null;
        this.showNotification('Ride request was cancelled by rider', 'info');
        this.closeRideRequestModal();
      }
    });

    // Ride accepted by another driver
    this.socket.on('ride:acceptedByOther', (data) => {
      console.log('⚠️ Ride accepted by another driver:', data);
      if (this.currentRideRequest && this.currentRideRequest.rideId === data.rideId) {
        this.currentRideRequest = null;
        this.showNotification('This ride was accepted by another driver', 'info');
        this.closeRideRequestModal();
      }
    });
  }

  // Subscribe to ride requests
  subscribeToRideRequests() {
    if (this.socket && this.driverId) {
      this.socket.emit('driver:subscribe', { driverId: this.driverId });
      console.log('✅ Subscribed to ride requests');
    }
  }

  // Unsubscribe from ride requests (when going offline)
  unsubscribeFromRideRequests() {
    if (this.socket && this.driverId) {
      this.socket.emit('driver:unsubscribe', { driverId: this.driverId });
      console.log('❌ Unsubscribed from ride requests');
    }
  }

  // Handle incoming ride request
  handleRideRequest(rideData) {
    this.currentRideRequest = rideData;
    
    // Play notification sound
    this.playNotificationSound();
    
    // Notify all registered handlers
    this.rideRequestHandlers.forEach(handler => {
      try {
        handler(rideData);
      } catch (error) {
        console.error('Error in ride request handler:', error);
      }
    });
  }

  // Register a handler for ride requests
  onRideRequest(callback) {
    if (typeof callback === 'function') {
      this.rideRequestHandlers.push(callback);
    }
  }

  // Accept ride request
  async acceptRide(rideId) {
    try {
      console.log('🔐 Getting token from localStorage...');
      const token = localStorage.getItem('rapidride_token') || localStorage.getItem('token');
      console.log('🔑 Token found:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      
      const url = `/api/driver/rides/${rideId}/accept`;
      console.log('🌐 Making request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📦 Response data:', result);
      
      if (result.success) {
        console.log('✅ Ride accepted:', result);
        this.currentRideRequest = null;
        this.showNotification('Ride accepted! Navigate to pickup location.', 'success');
        return { success: true, ride: result.ride };
      } else {
        console.error('Failed to accept ride:', result.message);
        this.showNotification(result.message || 'Failed to accept ride', 'error');
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
      this.showNotification('Error accepting ride. Please try again.', 'error');
      return { success: false, message: error.message };
    }
  }

  // Reject ride request
  rejectRide(rideId) {
    console.log('❌ Ride rejected:', rideId);
    this.currentRideRequest = null;
    this.closeRideRequestModal();
  }

  // Update driver location
  updateLocation(location) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('driver:updateLocation', location);
    }
  }

  // Subscribe to specific ride
  subscribeToRide(rideId) {
    if (this.socket) {
      this.socket.emit('subscribe_ride', { rideId });
      console.log(`✅ Subscribed to ride ${rideId}`);
    }
  }

  // Unsubscribe from specific ride
  unsubscribeFromRide(rideId) {
    if (this.socket) {
      this.socket.emit('unsubscribe_ride', { rideId });
      console.log(`❌ Unsubscribed from ride ${rideId}`);
    }
  }

  // Play notification sound
  playNotificationSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQxHnOLyvmkdBjaO0fLPejEGHGq+7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQxHnOLyvmkdBjaO0fLPejEGHGq+7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQxHnOLyvmkdBjaO0fLPejEGHGq+7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQxHnOLyvmkdBjaO0fLPejEGHGq+7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQxHnOLyvmkdBjaO0fLPejEGHGq+7+OZTRQMUX7S8uSKRQkYarnr46ljEwk9lemvXhYLSnfT8NSOQAwNYcTs7ZxPEQ==');
      audio.play();
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  // Show browser notification
  showNotification(message, type = 'info') {
    // Check if browser supports notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('RapidRide Driver', {
        body: message,
        icon: '/rapidride_logo.png',
        badge: '/rapidride_logo.png'
      });
    }
    
    // Also show in-app notification
    this.showInAppNotification(message, type);
  }

  // Show in-app notification
  showInAppNotification(message, type) {
    // This will be implemented in the dashboard
    if (window.showDriverNotification) {
      window.showDriverNotification(message, type);
    }
  }

  // Close ride request modal
  closeRideRequestModal() {
    if (window.closeRideRequestModal) {
      window.closeRideRequestModal();
    }
  }

  // Request notification permission
  static async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.unsubscribeFromRideRequests();
      this.socket.disconnect();
      console.log('🔌 Driver socket disconnected');
    }
  }

  // Check if connected
  isConnected() {
    return this.socket && this.socket.connected;
  }
}

// Export singleton instance
export const driverSocketManager = new DriverSocketManager();
