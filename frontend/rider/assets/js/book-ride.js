// Book Ride Page
import { SocketManager } from './socket.js';
import { GeocodingAPI } from './geocoding.js';
import { AutocompleteHandler } from './autocomplete.js';

class BookRidePage {
  constructor() {
    this.map = null;
    this.pickupMarker = null;
    this.dropMarker = null;
    this.routeLine = null;
    this.pickupLocation = null;
    this.dropLocation = null;
    this.selectedRideType = null;
    this.geocoder = new GeocodingAPI();
    this.socketManager = new SocketManager();
    this.token = localStorage.getItem('rapidride_token');
  }

  async init() {
    console.log('🚗 Initializing Book Ride page...');

    // Check authentication
    if (!this.token) {
      window.location.href = '../../login.html';
      return;
    }

    // Initialize map after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initMap();
    }, 100);

    // Setup autocomplete
    this.setupAutocomplete();

    // Setup event listeners
    this.setupEventListeners();

    // Get current location
    setTimeout(() => {
      this.getCurrentLocation();
    }, 500);
  }

  initMap() {
    // Default to Bangalore
    const defaultLat = 12.9716;
    const defaultLng = 77.5946;

    this.map = L.map('map').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Add click listener for map to set locations
    this.map.on('click', async (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Get address from coordinates
      const address = await this.geocoder.reverseGeocode(lat, lng);
      
      if (!this.pickupLocation) {
        // Set pickup first
        document.getElementById('pickupInput').value = address;
        this.setPickupLocation({ address, lat, lng });
      } else if (!this.dropLocation) {
        // Then set drop
        document.getElementById('dropInput').value = address;
        this.setDropLocation({ address, lat, lng });
      } else {
        // If both are set, clicking map sets drop to new location
        document.getElementById('dropInput').value = address;
        this.setDropLocation({ address, lat, lng });
      }
    });

    console.log('🗺️ Map initialized with click selection');
  }

  setupAutocomplete() {
    // Setup pickup autocomplete
    const pickupHandler = new AutocompleteHandler(
      'pickupInput',
      'pickupDropdown',
      (location) => {
        this.setPickupLocation(location);
      }
    );

    // Setup drop autocomplete
    const dropHandler = new AutocompleteHandler(
      'dropInput',
      'dropDropdown',
      (location) => {
        this.setDropLocation(location);
      }
    );
  }

  setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });

    // Use current location button
    document.getElementById('useCurrentLocationBtn').addEventListener('click', () => {
      this.getCurrentLocation();
    });

    // My location button
    document.getElementById('myLocationBtn').addEventListener('click', () => {
      this.getCurrentLocation();
    });

    // Ride type cards
    document.querySelectorAll('.ride-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectRideType(card.dataset.type);
      });
    });

    // Confirm ride button
    document.getElementById('confirmRideBtn').addEventListener('click', () => {
      this.requestRide();
    });
  }

  getCurrentLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          this.map.setView([lat, lng], 15);

          // Add a temporary blue marker for current location
          const currentLocationIcon = L.divIcon({
            html: '<div style="background: #3498db; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 0 15px rgba(52, 152, 219, 0.8); animation: pulse 2s infinite;"></div>',
            className: 'current-location-marker',
            iconSize: [20, 20]
          });

          const currentMarker = L.marker([lat, lng], { icon: currentLocationIcon })
            .addTo(this.map)
            .bindPopup('<b>Your Current Location</b>');

          // Remove marker after 3 seconds
          setTimeout(() => {
            this.map.removeLayer(currentMarker);
          }, 3000);

          // Reverse geocode to get address
          const address = await this.geocoder.reverseGeocode(lat, lng);
          
          if (address) {
            document.getElementById('pickupInput').value = address;
            this.setPickupLocation({
              address: address,
              lat: lat,
              lng: lng
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please enable location services.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  setPickupLocation(location) {
    this.pickupLocation = location;
    console.log('📍 Pickup set:', location);

    // Update marker
    if (this.pickupMarker) {
      this.map.removeLayer(this.pickupMarker);
    }

    const pickupIcon = L.divIcon({
      html: '<div style="background: #27ae60; color: white; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 4px 12px rgba(39,174,96,0.4);">📍</div>',
      className: 'custom-marker',
      iconSize: [45, 45]
    });

    this.pickupMarker = L.marker([location.lat, location.lng], { icon: pickupIcon })
      .addTo(this.map)
      .bindPopup('<b>Pickup Location</b><br>' + location.address);

    // Only center if drop is not set, otherwise fit bounds
    if (!this.dropLocation) {
      this.map.setView([location.lat, location.lng], 15);
    } else {
      const bounds = L.latLngBounds([
        [this.pickupLocation.lat, this.pickupLocation.lng],
        [this.dropLocation.lat, this.dropLocation.lng]
      ]);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Update UI
    this.updateUIState();
    this.calculateFares();
  }

  setDropLocation(location) {
    this.dropLocation = location;
    console.log('🎯 Drop set:', location);

    // Update marker
    if (this.dropMarker) {
      this.map.removeLayer(this.dropMarker);
    }

    const dropIcon = L.divIcon({
      html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid white; box-shadow: 0 4px 12px rgba(231,76,60,0.4);">🎯</div>',
      className: 'custom-marker',
      iconSize: [45, 45]
    });

    this.dropMarker = L.marker([location.lat, location.lng], { icon: dropIcon })
      .addTo(this.map)
      .bindPopup('<b>Drop Location</b><br>' + location.address);

    // Draw route line
    if (this.pickupLocation) {
      if (this.routeLine) {
        this.map.removeLayer(this.routeLine);
      }

      this.routeLine = L.polyline([
        [this.pickupLocation.lat, this.pickupLocation.lng],
        [this.dropLocation.lat, this.dropLocation.lng]
      ], {
        color: '#667eea',
        weight: 5,
        opacity: 0.8,
        dashArray: '10, 10',
        dashOffset: '0'
      }).addTo(this.map);

      // Animate the dashed line
      let offset = 0;
      setInterval(() => {
        offset += 2;
        if (this.routeLine) {
          this.routeLine.setStyle({ dashOffset: offset });
        }
      }, 100);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([
        [this.pickupLocation.lat, this.pickupLocation.lng],
        [this.dropLocation.lat, this.dropLocation.lng]
      ]);
      this.map.fitBounds(bounds, { padding: [80, 80] });
    } else {
      this.map.setView([location.lat, location.lng], 15);
    }

    // Update UI
    this.updateUIState();
    this.calculateFares();
  }

  calculateFares() {
    if (!this.pickupLocation || !this.dropLocation) {
      return;
    }

    // Calculate distance (Haversine formula)
    const distance = this.calculateDistance(
      this.pickupLocation.lat,
      this.pickupLocation.lng,
      this.dropLocation.lat,
      this.dropLocation.lng
    );

    console.log('📏 Distance:', distance, 'km');

    // Calculate fares for each ride type
    const fares = {
      economy: this.calculateFare(distance, 10, 8, 50),
      comfort: this.calculateFare(distance, 15, 12, 80),
      premium: this.calculateFare(distance, 20, 18, 120),
      shared: this.calculateFare(distance, 6, 5, 30)
    };

    // Update UI
    document.querySelectorAll('.ride-card').forEach(card => {
      const type = card.dataset.type;
      const priceElement = card.querySelector('.price-value');
      priceElement.textContent = Math.round(fares[type]);
    });
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  calculateFare(distance, baseFare, perKm, minFare) {
    const fare = baseFare + (distance * perKm);
    return Math.max(fare, minFare);
  }

  selectRideType(type) {
    // Remove selected class from all cards
    document.querySelectorAll('.ride-card').forEach(card => {
      card.classList.remove('selected');
    });

    // Add selected class to clicked card
    const selectedCard = document.querySelector(`.ride-card[data-type="${type}"]`);
    selectedCard.classList.add('selected');

    this.selectedRideType = type;
    console.log('🚗 Selected ride type:', type);

    // Update UI
    this.updateUIState();
  }

  updateUIState() {
    const confirmBtn = document.getElementById('confirmRideBtn');
    const btnText = confirmBtn.querySelector('.btn-text');

    if (this.pickupLocation && this.dropLocation && this.selectedRideType) {
      confirmBtn.disabled = false;
      btnText.textContent = '🚀 Confirm Ride';
    } else if (!this.pickupLocation || !this.dropLocation) {
      confirmBtn.disabled = true;
      btnText.textContent = 'Enter Pickup & Drop Locations';
    } else if (!this.selectedRideType) {
      confirmBtn.disabled = true;
      btnText.textContent = 'Select a Ride Type';
    }
  }

  async requestRide() {
    if (!this.pickupLocation || !this.dropLocation || !this.selectedRideType) {
      return;
    }

    // Calculate distance and fare
    const distance = this.calculateDistance(
      this.pickupLocation.lat,
      this.pickupLocation.lng,
      this.dropLocation.lat,
      this.dropLocation.lng
    );

    const fares = {
      economy: this.calculateFare(distance, 10, 8, 50),
      comfort: this.calculateFare(distance, 15, 12, 80),
      premium: this.calculateFare(distance, 20, 18, 120),
      shared: this.calculateFare(distance, 6, 5, 30)
    };

    const fare = Math.round(fares[this.selectedRideType]);

    // Show loading
    const confirmBtn = document.getElementById('confirmRideBtn');
    const btnText = confirmBtn.querySelector('.btn-text');
    btnText.innerHTML = '<div class="spinner"></div> Requesting...';
    confirmBtn.disabled = true;

    try {
      const response = await fetch('/api/rider/rides/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pickupLocation: this.pickupLocation,
          dropoffLocation: this.dropLocation,
          type: this.selectedRideType,
          fare: fare,
          distanceKm: distance.toFixed(2)
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Ride requested successfully:', result);
        
        // Store ride data
        localStorage.setItem('currentRide', JSON.stringify(result.ride));
        
        // Connect to socket and subscribe to ride updates
        if (!this.socketManager.isConnected()) {
          const riderId = this.getTokenPayload().userId;
          this.socketManager.connect(riderId);
        }
        
        // Subscribe to ride updates
        this.socketManager.subscribeToRide(result.ride._id);
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
      } else {
        throw new Error(result.message || 'Failed to request ride');
      }
    } catch (error) {
      console.error('❌ Error requesting ride:', error);
      alert('Failed to request ride. Please try again.');
      
      // Reset button
      btnText.textContent = '🚀 Confirm Ride';
      confirmBtn.disabled = false;
    }
  }

  getTokenPayload() {
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error parsing token:', error);
      return {};
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const bookRidePage = new BookRidePage();
  bookRidePage.init();
});

export default BookRidePage;
