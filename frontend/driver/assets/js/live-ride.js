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
      // Try to get ride data from localStorage first
      const storedRide = localStorage.getItem('currentDriverRide');
      if (storedRide) {
        this.rideData = JSON.parse(storedRide);
        this.rideId = this.rideData._id;
        console.log('✅ Loaded ride data from localStorage:', this.rideData);
      } else {
        // Fetch from API
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
          localStorage.setItem('currentDriverRide', JSON.stringify(this.rideData));
          console.log('✅ Loaded ride data from API:', this.rideData);
        } else {
          throw new Error('No active ride found');
        }
      }
      
      // Update UI with ride details
      this.updateRideInfo();
      
    } catch (error) {
      console.error('❌ Error loading ride data:', error);
      alert('No active ride found. Redirecting to dashboard...');
      window.location.href = 'dashboard.html';
    }
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
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/driver/cancel-ride`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rideId: this.rideId })
      });
      
      const result = await response.json();
      if (result.success) {
        this.showNotification('Trip cancelled');
        setTimeout(() => {
          localStorage.removeItem('currentDriverRide');
          window.location.href = 'dashboard.html';
        }, 1500);
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
      driverSocketManager.subscribeToRide(this.rideId);
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
});

export default DriverLiveRide;
