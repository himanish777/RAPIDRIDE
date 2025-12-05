// Socket.IO Module - Real-time communication
export class SocketManager {
  constructor() {
    this.socket = null;
    // Prefer connecting to same origin (backend serves frontend). Fallback to localhost:5500.
    this.serverURL = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'http://localhost:5500';
    this.token = localStorage.getItem('rapidride_token');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Connect to Socket.IO server
  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    try {
      const url = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : this.serverURL;
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
      console.log('🔌 Socket connecting...');
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  // Setup socket event handlers
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.reconnectAttempts = 0;
      const riderId = this.getRiderId();
      console.log('🔍 DEBUG: riderId from getRiderId():', riderId);
      this.emit('rider_online', { riderId });
      // Subscribe to personal rider room for notifications
      if (riderId) {
        console.log('📡 Emitting rider:subscribe with riderId:', riderId);
        this.emit('rider:subscribe', { riderId });
      } else {
        console.error('❌ Cannot subscribe - riderId is null/undefined');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, attempt manual reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to socket server');
    });

    // Ride events
    this.socket.on('ride_requested', (data) => {
      console.log('Ride requested:', data);
    });

    this.socket.on('driver_searching', (data) => {
      console.log('Searching for drivers:', data);
    });

    this.socket.on('driver_found', (data) => {
      console.log('Driver found:', data);
    });

    this.socket.on('driver_assigned', (data) => {
      console.log('Driver assigned:', data);
    });

    this.socket.on('driver_arriving', (data) => {
      console.log('Driver arriving:', data);
    });

    this.socket.on('driver_arrived', (data) => {
      console.log('Driver arrived:', data);
    });

    this.socket.on('trip_started', (data) => {
      console.log('Trip started:', data);
    });

    this.socket.on('trip_completed', (data) => {
      console.log('Trip completed:', data);
    });

    this.socket.on('ride_cancelled', (data) => {
      console.log('Ride cancelled:', data);
    });

    // Location tracking
    this.socket.on('driver_location_update', (data) => {
      console.log('Driver location updated:', data);
    });

    this.socket.on('route_update', (data) => {
      console.log('Route updated:', data);
    });

    // Route deviation alert
    this.socket.on('route_deviation', (data) => {
      console.warn('⚠️ Route deviation detected:', data);
    });

    // Notifications
    this.socket.on('notification', (data) => {
      console.log('📢 New notification:', data);
    });

    // Emergency
    this.socket.on('sos_acknowledged', (data) => {
      console.log('🆘 SOS acknowledged:', data);
    });

    // Fare updates
    this.socket.on('fare_update', (data) => {
      console.log('💰 Fare updated:', data);
    });

    // Chat messages (if implemented)
    this.socket.on('message', (data) => {
      console.log('💬 New message:', data);
    });

    // System messages
    this.socket.on('system_message', (data) => {
      console.log('🔔 System message:', data);
    });
  }

  // Emit events to server
  emit(event, data) {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected. Cannot emit:', event);
      return;
    }

    this.socket.emit(event, data);
    console.log(`📤 Emitted ${event}:`, data);
  }

  // Listen to specific events (wrapper for external use)
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized');
      return;
    }

    this.socket.on(event, callback);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Socket disconnected manually');
    }
  }

  // Check connection status
  isConnected() {
    return this.socket?.connected || false;
  }

  // Get socket ID
  getSocketId() {
    return this.socket?.id || null;
  }

  // Get rider ID from local storage
  getRiderId() {
    const rider = localStorage.getItem('rapidride_rider');
    if (rider) {
      const parsed = JSON.parse(rider);
      return parsed.id;
    }
    return null;
  }

  // ===== RIDE-SPECIFIC SOCKET METHODS =====

  // Request a ride
  requestRide(rideData) {
    this.emit('request_ride', {
      riderId: this.getRiderId(),
      ...rideData,
      timestamp: new Date().toISOString()
    });
  }

  // Cancel ride
  cancelRide(rideId) {
    this.emit('cancel_ride', {
      riderId: this.getRiderId(),
      rideId,
      timestamp: new Date().toISOString()
    });
  }

  // Update rider location
  updateLocation(location) {
    this.emit('rider_location_update', {
      riderId: this.getRiderId(),
      location,
      timestamp: new Date().toISOString()
    });
  }

  // Send message to driver
  sendMessage(message, rideId) {
    this.emit('send_message', {
      riderId: this.getRiderId(),
      rideId,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Trigger SOS
  triggerSOS(location) {
    this.emit('sos_alert', {
      riderId: this.getRiderId(),
      location,
      timestamp: new Date().toISOString()
    });
  }

  // Report route deviation
  reportDeviation(deviationData) {
    this.emit('report_deviation', {
      riderId: this.getRiderId(),
      ...deviationData,
      timestamp: new Date().toISOString()
    });
  }

  // Rate driver
  rateDriver(rideId, rating, feedback) {
    this.emit('rate_driver', {
      riderId: this.getRiderId(),
      rideId,
      rating,
      feedback,
      timestamp: new Date().toISOString()
    });
  }

  // Subscribe to ride updates
  subscribeToRide(rideId) {
    this.emit('subscribe_ride', {
      riderId: this.getRiderId(),
      rideId
    });
  }

  // Unsubscribe from ride updates
  unsubscribeFromRide(rideId) {
    this.emit('unsubscribe_ride', {
      riderId: this.getRiderId(),
      rideId
    });
  }
}

export default SocketManager;