// Driver Live Ride Tracking
import { driverSocketManager } from './socket.js';

class DriverLiveRide {
  constructor() {
    this.map = null;
    this.rideData = null;
    this.driverMarker = null;
    this.riderMarker = null;
    this.pickupMarker = null;
    this.dropMarker = null;
    this.routeLine = null;
    this.currentStatus = 'assigned'; // assigned, arriving, on_trip
    this.locationUpdateInterval = null;
    this.autoRefreshInterval = null;
    this.driverId = null;
    this.rideId = null;
  }

  async init() {
    console.log('🚗 Initializing driver live ride...');
    
    // Check authentication - driver uses 'token' key
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ No token found in live-ride');
      alert('Please login as driver first');
      window.location.href = '../../login.html';
      return;
    }

    // Get driver ID from token or storage
    this.driverId = this.getDriverIdFromToken(token);
    console.log('👤 Driver ID:', this.driverId);
    
    // CRITICAL: Ensure socket manager is connected BEFORE loading ride
    if (!driverSocketManager.isConnected()) {
      console.log('🔌 Connecting driver socket manager...');
      driverSocketManager.connect(this.driverId);
      
      // Wait a moment for socket to connect
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Load ride data
    await this.loadRideData();
    
    // Initialize map
    this.initMap();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Connect socket and subscribe to ride updates
    this.setupSocketConnection();
    
    // Start location tracking
    this.startLocationTracking();
    
    // Start auto-refresh
    this.startAutoRefresh();
    
    // Update UI based on current status
    this.updateUIForStatus();
  }

  getDriverIdFromToken(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }

  async loadRideData() {
    try {
      // Always fetch fresh data from API to avoid stale localStorage
      const token = localStorage.getItem('token');
      const response = await fetch('/api/driver/current-ride', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success && result.ride) {
        this.rideData = result.ride;
        this.rideId = this.rideData._id;
        // Update localStorage with fresh data
        localStorage.setItem('currentDriverRide', JSON.stringify(this.rideData));
        console.log('✅ Loaded fresh ride data from API:', this.rideData);
        console.log('✅ Current rideId:', this.rideId);
        console.log('✅ Current ride status:', this.rideData.status);
      } else {
        throw new Error('No active ride found');
      }
      
      // Update UI with ride details
      this.updateRideInfo();
      
    } catch (error) {
      console.error('❌ Error loading ride data:', error);
      alert('No active ride found. Redirecting to dashboard...');
      window.location.href = 'dashboard.html';
    }
  }

  // Auto-refresh ride data periodically
  startAutoRefresh() {
    // Refresh every 5 seconds
    this.autoRefreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing ride data...');
        const token = localStorage.getItem('token');
        const response = await fetch('/api/driver/current-ride', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success && result.ride) {
          const ride = result.ride;
          
          // Check if ride was cancelled
          if (ride.status === 'cancelled') {
            clearInterval(this.autoRefreshInterval);
            console.log('🚫 Ride was cancelled - detected via auto-refresh');
            const cancelledBy = ride.cancelledBy === 'rider' ? 'rider' : 'driver';
            if (cancelledBy === 'rider') {
              this.showRiderCancelledModal('Rider cancelled the ride');
            }
            return;
          }
          
          // Update ride data and localStorage
          this.rideData = ride;
          this.rideId = ride._id;
          localStorage.setItem('currentDriverRide', JSON.stringify(ride));
          
          // Update UI
          this.updateRideInfo();
          
          console.log('✅ Auto-refresh complete - status:', ride.status);
        } else {
          // No active ride found
          clearInterval(this.autoRefreshInterval);
          console.log('⚠️ No active ride - stopping auto-refresh');
        }
      } catch (error) {
        console.error('❌ Auto-refresh error:', error);
      }
    }, 5000);
    
    console.log('✅ Auto-refresh started (every 5 seconds)');
  }

  initMap() {
    // Default to Bangalore
    const defaultLat = 12.9716;
    const defaultLng = 77.5946;
    
    this.map = L.map('map').setView([defaultLat, defaultLng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    console.log('🗺️ Map initialized');
    
    // Add markers for pickup and drop locations
    this.addLocationMarkers();
    
    // Get current location and add driver marker
    this.getCurrentLocation();
  }

  addLocationMarkers() {
    if (!this.rideData) return;
    
    const pickupLat = this.rideData.pickupLocation?.lat || 12.9716;
    const pickupLng = this.rideData.pickupLocation?.lng || 77.5946;
    
    const dropLat = this.rideData.dropoffLocation?.lat || 12.9716;
    const dropLng = this.rideData.dropoffLocation?.lng || 77.5946;
    
    // Pickup marker (green)
    const pickupIcon = L.divIcon({
      html: '<div style="background: #27ae60; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">📍</div>',
      className: 'custom-marker',
      iconSize: [40, 40]
    });
    
    this.pickupMarker = L.marker([pickupLat, pickupLng], { icon: pickupIcon })
      .addTo(this.map)
      .bindPopup('Pickup Location');
    
    // Drop marker (red)
    const dropIcon = L.divIcon({
      html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🎯</div>',
      className: 'custom-marker',
      iconSize: [40, 40]
    });
    
    this.dropMarker = L.marker([dropLat, dropLng], { icon: dropIcon })
      .addTo(this.map)
      .bindPopup('Drop Location');
    
    // Fit bounds to show both markers
    const bounds = L.latLngBounds([
      [pickupLat, pickupLng],
      [dropLat, dropLng]
    ]);
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  getCurrentLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          this.updateDriverMarker(lat, lng);
          this.map.setView([lat, lng], 15);
          
          console.log('📍 Current location:', { lat, lng });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }

  updateDriverMarker(lat, lng) {
    const driverIcon = L.divIcon({
      html: '<div style="background: #667eea; color: white; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);">🚗</div>',
      className: 'driver-marker',
      iconSize: [45, 45]
    });
    
    if (this.driverMarker) {
      this.driverMarker.setLatLng([lat, lng]);
    } else {
      this.driverMarker = L.marker([lat, lng], { icon: driverIcon })
        .addTo(this.map)
        .bindPopup('You are here');
    }
    
    // Emit location update to server
    if (driverSocketManager.isConnected() && this.rideId) {
      driverSocketManager.updateLocation({
        rideId: this.rideId,
        lat: lat,
        lng: lng
      });
    }
  }

  startLocationTracking() {
    if ('geolocation' in navigator) {
      // Update location every 5 seconds
      this.locationUpdateInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            this.updateDriverMarker(lat, lng);
          },
          (error) => {
            console.error('Error tracking location:', error);
          }
        );
      }, 5000);
    }
  }

  updateRideInfo() {
    if (!this.rideData) return;
    
    // Update rider info
    const riderName = this.rideData.rider?.name || 'Rider';
    const riderPhone = this.rideData.rider?.phone || '+91 XXXXX XXXXX';
    const riderRating = this.rideData.rider?.rating || 4.8;
    
    document.getElementById('riderName').textContent = riderName;
    document.getElementById('riderPhone').textContent = riderPhone;
    document.getElementById('riderRating').textContent = riderRating.toFixed(1);
    document.getElementById('riderInitials').textContent = this.getInitials(riderName);
    
    // Update locations
    document.getElementById('pickupAddress').textContent = this.rideData.pickupLocation?.address || 'Loading...';
    document.getElementById('dropAddress').textContent = this.rideData.dropoffLocation?.address || 'Loading...';
    document.getElementById('nextStopAddress').textContent = this.currentStatus === 'on_trip' 
      ? this.rideData.dropoffLocation?.address 
      : this.rideData.pickupLocation?.address;
    
    // Update fare info
    document.getElementById('tripType').textContent = this.rideData.type || 'Economy';
    document.getElementById('tripDistance').textContent = `${this.rideData.distanceKm || 0} km`;
    document.getElementById('fareAmount').textContent = `₹${this.rideData.fare || 0}`;
    
    // Update status
    this.currentStatus = this.rideData.status;
  }

  getInitials(name) {
    if (!name) return 'R';
    const parts = name.split(' ');
    return parts.length >= 2 
      ? (parts[0][0] + parts[1][0]).toUpperCase() 
      : name.substring(0, 2).toUpperCase();
  }

  updateUIForStatus() {
    const arrivedBtn = document.getElementById('arrivedAtPickupBtn');
    const startTripBtn = document.getElementById('startTripBtn');
    const completeTripBtn = document.getElementById('completeTripBtn');
    const statusEl = document.getElementById('rideStatus');
    const subStatusEl = document.getElementById('rideSubStatus');
    
    // Hide all buttons first
    arrivedBtn.style.display = 'none';
    startTripBtn.style.display = 'none';
    completeTripBtn.style.display = 'none';
    
    switch (this.currentStatus) {
      case 'assigned':
      case 'arriving':
        arrivedBtn.style.display = 'flex';
        statusEl.textContent = 'Heading to Pickup';
        subStatusEl.textContent = 'Navigate to pickup location';
        break;
        
      case 'waiting':
        startTripBtn.style.display = 'flex';
        statusEl.textContent = 'At Pickup Location';
        subStatusEl.textContent = 'Waiting for rider';
        break;
        
      case 'on_trip':
        completeTripBtn.style.display = 'flex';
        statusEl.textContent = 'Trip in Progress';
        subStatusEl.textContent = 'Navigate to destination';
        break;
    }
  }

  setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to go back? The trip is still active.')) {
        window.location.href = 'dashboard.html';
      }
    });
    
    // My location button
    document.getElementById('myLocationBtn').addEventListener('click', () => {
      this.getCurrentLocation();
    });
    
    // Arrived at pickup
    document.getElementById('arrivedAtPickupBtn').addEventListener('click', () => {
      this.handleArrivedAtPickup();
    });
    
    // Start trip
    document.getElementById('startTripBtn').addEventListener('click', () => {
      this.handleStartTrip();
    });
    
    // Complete trip
    document.getElementById('completeTripBtn').addEventListener('click', () => {
      this.handleCompleteTrip();
    });
    
    // Cancel trip
    document.getElementById('cancelTripBtn').addEventListener('click', () => {
      document.getElementById('cancelModal').style.display = 'flex';
    });
    
    document.getElementById('cancelCancelBtn').addEventListener('click', () => {
      document.getElementById('cancelModal').style.display = 'none';
    });
    
    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
      this.handleCancelTrip();
    });
    
    // Call rider
    document.getElementById('callRiderBtn').addEventListener('click', () => {
      const phone = this.rideData?.rider?.phone;
      if (phone) {
        window.location.href = `tel:${phone}`;
      }
    });
    
    // Message rider
    document.getElementById('messageRiderBtn').addEventListener('click', () => {
      const phone = this.rideData?.rider?.phone;
      if (phone) {
        window.location.href = `sms:${phone}`;
      }
    });
    
    // Minimize navigation card
    document.getElementById('minimizeNavBtn').addEventListener('click', () => {
      document.getElementById('navigationCard').classList.toggle('minimized');
    });
    
    // Back to dashboard after completion
    document.getElementById('backToDashboardBtn').addEventListener('click', () => {
      localStorage.removeItem('currentDriverRide');
      window.location.href = 'dashboard.html';
    });
  }

  async handleArrivedAtPickup() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/rides/${this.rideId}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'waiting' })
      });
      
      const result = await response.json();
      if (result.success) {
        this.currentStatus = 'waiting';
        this.updateUIForStatus();
        this.showNotification('✅ Marked as arrived at pickup');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      this.showNotification('❌ Failed to update status', 'error');
    }
  }

  async handleStartTrip() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/start-ride`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rideId: this.rideId })
      });
      
      const result = await response.json();
      if (result.success) {
        this.currentStatus = 'on_trip';
        this.updateUIForStatus();
        this.showNotification('✅ Trip started!');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      this.showNotification('❌ Failed to start trip', 'error');
    }
  }

  async handleCompleteTrip() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/complete-ride`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rideId: this.rideId })
      });
      
      const result = await response.json();
      if (result.success) {
        this.showCompletionModal(result.ride);
      }
    } catch (error) {
      console.error('Error completing trip:', error);
      this.showNotification('❌ Failed to complete trip', 'error');
    }
  }

  async handleCancelTrip() {
    try {
      document.getElementById('cancelModal').style.display = 'none';
      
      if (!this.rideId) {
        console.error('❌ No rideId available');
        this.showNotification('❌ No active ride to cancel', 'error');
        return;
      }
      
      console.log('🔍 Cancelling ride with ID:', this.rideId);
      console.log('🔍 Driver ID:', this.driverId);
      console.log('🔍 Ride data:', this.rideData);
      
      const token = localStorage.getItem('token');
      const requestBody = { rideId: this.rideId };
      console.log('📤 Sending request body:', requestBody);
      
      const response = await fetch(`/api/driver/cancel-ride`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Cancel response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Cancel failed:', response.status, errorText);
        throw new Error(`Cancel failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Cancel result:', result);
      
      if (result.success) {
        this.showNotification('Trip cancelled');
        setTimeout(() => {
          localStorage.removeItem('currentDriverRide');
          window.location.href = 'dashboard.html';
        }, 1500);
      } else {
        throw new Error(result.message || 'Cancel failed');
      }
    } catch (error) {
      console.error('Error cancelling trip:', error);
      this.showNotification('❌ Failed to cancel trip', 'error');
    }
  }

  showCompletionModal(ride) {
    const modal = document.getElementById('completionModal');
    
    document.getElementById('finalDistance').textContent = `${ride.distanceKm || 0} km`;
    document.getElementById('finalDuration').textContent = `${this.calculateDuration(ride)} min`;
    document.getElementById('finalFare').textContent = `₹${ride.fare || 0}`;
    
    const commission = 0.2; // 20% commission
    const earnings = (ride.fare || 0) * (1 - commission);
    document.getElementById('driverEarnings').textContent = `₹${earnings.toFixed(0)}`;
    
    modal.style.display = 'flex';
  }

  calculateDuration(ride) {
    if (ride.startedAt && ride.completedAt) {
      const start = new Date(ride.startedAt);
      const end = new Date(ride.completedAt);
      return Math.round((end - start) / 60000); // minutes
    }
    return 0;
  }

  setupSocketConnection() {
    if (driverSocketManager.isConnected()) {
      console.log('📡 Setting up socket listeners for driver live-ride...');
      
      // Subscribe to ride updates (driver:subscribe already handled by socket manager)
      driverSocketManager.subscribeToRide(this.rideId);
      
      // Listen for rider cancellation
      const socket = driverSocketManager.socket;
      if (socket) {
        // Remove any existing listeners to prevent duplicates
        socket.off('ride:cancelled_by_rider');
        
        socket.on('ride:cancelled_by_rider', (data) => {
          console.log('🚫 Rider cancelled ride:', data);
          this.showRiderCancelledModal(data.message || 'Rider has cancelled the ride');
        });
        console.log('✅ Listening for ride:cancelled_by_rider events');
      }
    } else {
      console.error('❌ Socket manager not connected!');
    }
  }

  showRiderCancelledModal(message) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('riderCancelledModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'riderCancelledModal';
      modal.className = 'modal';
      modal.style.cssText = 'display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 99999;';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          <div class="modal-header" style="margin-bottom: 16px;">
            <h2 style="margin: 0; color: #e74c3c; font-size: 20px;">🚫 Ride Cancelled</h2>
          </div>
          <div class="modal-body">
            <p style="font-size: 16px; margin-bottom: 12px; color: #333;">${message}</p>
            <p style="color: #666; font-size: 14px;">The rider has cancelled this ride.</p>
            <div class="modal-actions" style="margin-top: 24px;">
              <button style="width: 100%; padding: 12px; background: #0D9488; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;" onclick="window.location.href='dashboard.html'">
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
    }
  }

  showNotification(message, type = 'info') {
    // Simple notification - could be enhanced
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const liveRide = new DriverLiveRide();
  liveRide.init();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (liveRide.autoRefreshInterval) {
      clearInterval(liveRide.autoRefreshInterval);
    }
    if (liveRide.locationUpdateInterval) {
      clearInterval(liveRide.locationUpdateInterval);
    }
  });
});

export default DriverLiveRide;
