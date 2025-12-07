// Import modules
import { RideManager } from './ride.js';
import { NotificationManager } from './notifications.js';
import { SocketManager } from './socket.js';
import { API } from './api.js';

// ===== DASHBOARD CONTROLLER =====
class DashboardController {
  constructor() {
    this.rideManager = new RideManager();
    this.notificationManager = new NotificationManager();
    this.socketManager = new SocketManager();
    this.api = new API();

    // Saved preferences
    try {
      this.currentMapStyle = localStorage.getItem('rr_map_style') || 'light';
      this.currentTheme = localStorage.getItem('rr_theme') || 'light';
    } catch (e) {
      this.currentMapStyle = 'light';
      this.currentTheme = 'light';
    }

    this.mapState = null;
    this.etaInterval = null;

    this.init();
  }

  init() {
    // Apply saved theme first
    this.applyTheme(this.currentTheme);

    this.setupEventListeners();
    this.highlightInitialSettings();
    
    // Initialize map after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.mapState = this.initMap(); // Leaflet map
      console.log('🗺️ Map initialized:', this.mapState ? 'Success' : 'Failed');
    }, 100);
    
    this.loadUserData();
    this.loadCurrentRide(); // Restore active ride if exists
    this.socketManager.connect();
    this.setupSocketListeners();
  }

  setupEventListeners() {
    // Setup location autocomplete
    this.setupLocationAutocomplete();

    const profileBtn = document.getElementById('profileBtn');
    const profileMenu = document.getElementById('profileMenu');
    
    profileBtn?.addEventListener('click', () => {
      profileMenu?.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.profile-dropdown')) {
        profileMenu?.classList.remove('active');
      }
    });

    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const closeNotificationBtn = document.getElementById('closeNotificationBtn');

    notificationBtn?.addEventListener('click', () => {
      notificationPanel?.classList.toggle('active');
    });

    closeNotificationBtn?.addEventListener('click', () => {
      notificationPanel?.classList.remove('active');
    });

    const rideRequestForm = document.getElementById('rideRequestForm');
    rideRequestForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRideRequest();
    });

    const rideTypeSelect = document.getElementById('rideTypeSelect');
    rideTypeSelect?.addEventListener('change', () => {
      this.updateFareEstimate();
    });

    const cancelRideBtn = document.getElementById('cancelRideBtn');
    cancelRideBtn?.addEventListener('click', () => {
      this.handleCancelRide();
    });

    const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
    viewLiveRideBtn?.addEventListener('click', () => {
      this.navigateToLiveRide();
    });

    // SOS
    const sosButton = document.getElementById('sosButton');
    const sosModal = document.getElementById('sosModal');
    const confirmSosBtn = document.getElementById('confirmSosBtn');
    const cancelSosBtn = document.getElementById('cancelSosBtn');

    sosButton?.addEventListener('click', () => {
      sosModal?.classList.add('active');
    });

    confirmSosBtn?.addEventListener('click', () => {
      this.triggerSOS();
      sosModal?.classList.remove('active');
    });

    cancelSosBtn?.addEventListener('click', () => {
      sosModal?.classList.remove('active');
    });

    // Contact Support (view only)
    const contactSupportBtn = document.getElementById('contactSupportBtn');
    const supportModal = document.getElementById('supportModal');
    const closeSupportModalBtn = document.getElementById('closeSupportModalBtn');

    contactSupportBtn?.addEventListener('click', () => {
      supportModal?.classList.add('active');
    });

    closeSupportModalBtn?.addEventListener('click', () => {
      supportModal?.classList.remove('active');
    });

    // Report Issue (form submission)
    const reportIssueBtn = document.getElementById('reportIssueBtn');
    const reportIssueModal = document.getElementById('reportIssueModal');
    const closeReportIssueModalBtn = document.getElementById('closeReportIssueModalBtn');

    reportIssueBtn?.addEventListener('click', () => {
      reportIssueModal?.classList.add('active');
    });

    closeReportIssueModalBtn?.addEventListener('click', () => {
      reportIssueModal?.classList.remove('active');
    });

    const reportIssueForm = document.getElementById('reportIssueForm');
    reportIssueForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleReportIssue();
      reportIssueModal?.classList.remove('active');
    });

    // FAQ
    const viewFaqBtn = document.getElementById('viewFaqBtn');
    const faqModal = document.getElementById('faqModal');
    const closeFaqModalBtn = document.getElementById('closeFaqModalBtn');

    viewFaqBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      faqModal?.classList.add('active');
    });

    closeFaqModalBtn?.addEventListener('click', () => {
      faqModal?.classList.remove('active');
    });

    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');

    settingsBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      settingsModal?.classList.add('active');
    });

    closeSettingsModalBtn?.addEventListener('click', () => {
      settingsModal?.classList.remove('active');
    });

    // Map style buttons
    document.querySelectorAll('[data-map-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-map-style');
        this.setMapStyle(style);
        document.querySelectorAll('[data-map-style]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Theme buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        this.applyTheme(theme);
        document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleLogout();
    });

    // Logout confirmation modal
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    
    confirmLogoutBtn?.addEventListener('click', () => {
      this.confirmLogout();
    });
    
    cancelLogoutBtn?.addEventListener('click', () => {
      const logoutModal = document.getElementById('logoutModal');
      logoutModal?.classList.remove('active');
    });

    const closeDeviationBtn = document.getElementById('closeDeviationBtn');
    closeDeviationBtn?.addEventListener('click', () => {
      document.getElementById('deviationModal')?.classList.remove('active');
    });

    const contactDriverBtn = document.getElementById('contactDriverBtn');
    contactDriverBtn?.addEventListener('click', () => {
      this.contactDriver();
    });

    // Favorite locations
    document.querySelectorAll('.favorite-item').forEach(item => {
      item.addEventListener('click', () => {
        const address = item.getAttribute('data-address');
        if (address) {
          const dropInput = document.getElementById('dropInput');
          if (dropInput) {
            dropInput.value = address;
            this.notificationManager.show(`Destination set to: ${address}`, 'success');
          }
        }
      });
    });

    // Schedule Ride Modal
    const scheduleRideBtn = document.querySelector('.prebookings-card .btn-secondary');
    const scheduleRideModal = document.getElementById('scheduleRideModal');
    const closeScheduleModalBtn = document.getElementById('closeScheduleModalBtn');
    const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
    const scheduleRideForm = document.getElementById('scheduleRideForm');

    scheduleRideBtn?.addEventListener('click', () => {
      scheduleRideModal?.classList.add('active');
    });

    closeScheduleModalBtn?.addEventListener('click', () => {
      scheduleRideModal?.classList.remove('active');
    });

    cancelScheduleBtn?.addEventListener('click', () => {
      scheduleRideModal?.classList.remove('active');
    });

    scheduleRideForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleScheduleRide();
    });

    const addFavoriteBtn = document.getElementById('addFavoriteBtn');
    addFavoriteBtn?.addEventListener('click', () => {
      this.notificationManager.show('Add favorite location feature coming soon!', 'info');
    });
  }

  setupLocationAutocomplete() {
    const MAPTILER_KEY = 't1z6B2LZrqsUyffdHC1I';
    const pickupInput = document.getElementById('pickupInput');
    const dropInput = document.getElementById('dropInput');
    const pickupDropdown = document.getElementById('pickupDropdown');
    const dropDropdown = document.getElementById('dropDropdown');

    // Store user's current location
    this.userLocation = null;

    let pickupTimeout;
    let dropTimeout;

    // Helper to get current position as Promise with a graceful fallback
    // First attempt: high accuracy, short timeout. On failure retry with
    // lower accuracy and longer timeout to improve success on desktops.
    this.getCurrentPosition = () => {
      return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          return reject(new Error('Geolocation not supported'));
        }

        const primaryOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        const fallbackOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 };

        // Try primary (fast, accurate). On error (typically timeout) retry once with fallback.
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          err => {
            // If timeout or position unavailable, retry with relaxed options once
            if (err && (err.code === 3 || err.code === 2)) {
              console.warn('Primary geolocation failed, retrying with fallback options:', err);
              navigator.geolocation.getCurrentPosition(
                pos => resolve(pos),
                fallbackErr => reject(fallbackErr),
                fallbackOptions
              );
            } else {
              // For permission denied (code 1) or other errors, fail fast
              reject(err);
            }
          },
          primaryOptions
        );
      });
    };

    // Add "Use Current Location" button for pickup - place it below the input
    const currentLocationBtn = document.createElement('button');
    currentLocationBtn.type = 'button';
    currentLocationBtn.className = 'btn-current-location';
    currentLocationBtn.innerHTML = '📍 Use My Location';
    currentLocationBtn.style.cssText = 'margin-top: 8px; width: 100%; background: #3498db; color: white; border: 2px solid #2E4053; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.3s;';
    
    const pickupWrapper = pickupInput?.parentElement;
    if (pickupWrapper) {
      pickupWrapper.appendChild(currentLocationBtn);
    }
    
    // Add hover effect
    currentLocationBtn.addEventListener('mouseenter', () => {
      currentLocationBtn.style.background = '#2980b9';
      currentLocationBtn.style.transform = 'translateY(-2px)';
      currentLocationBtn.style.boxShadow = '0 5px 15px rgba(52, 152, 219, 0.3)';
    });
    
    currentLocationBtn.addEventListener('mouseleave', () => {
      currentLocationBtn.style.background = '#3498db';
      currentLocationBtn.style.transform = 'translateY(0)';
      currentLocationBtn.style.boxShadow = 'none';
    });

    currentLocationBtn.addEventListener('click', async () => {
      if (!this.userLocation) {
        this.notificationManager.show('Getting your location...', 'info');
        try {
          const position = await this.getCurrentPosition();
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Reverse geocode to get address
          const response = await fetch(
            `https://api.maptiler.com/geocoding/${this.userLocation.lng},${this.userLocation.lat}.json?key=${MAPTILER_KEY}`
          );
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const address = data.features[0].place_name;
            pickupInput.value = address;
            pickupInput.dataset.coords = JSON.stringify([this.userLocation.lng, this.userLocation.lat]);
            this.notificationManager.show('Location set successfully', 'success');
            this.updateMapMarkers();
            this.updateFareEstimate();
          }
        } catch (error) {
          console.error('Location error:', error);
          // Provide more helpful guidance to the user depending on error
          if (error && error.code === 1) {
            this.notificationManager.show('Location permission denied. Please allow location access in your browser.', 'error');
          } else if (error && error.code === 3) {
            this.notificationManager.show('Location request timed out. Try again or ensure your device has location services enabled.', 'error');
          } else if (error && error.code === 2) {
            this.notificationManager.show('Unable to determine location. Check your network or try again.', 'error');
          } else {
            this.notificationManager.show('Failed to get location', 'error');
          }
        }
      } else {
        // Use cached location
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${this.userLocation.lng},${this.userLocation.lat}.json?key=${MAPTILER_KEY}`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const address = data.features[0].place_name;
          pickupInput.value = address;
          pickupInput.dataset.coords = JSON.stringify([this.userLocation.lng, this.userLocation.lat]);
          this.updateMapMarkers();
          this.updateFareEstimate();
        }
      }
    });

    // Get user location on load
    this.getCurrentPosition().then(position => {
      this.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    }).catch(() => {
      console.log('Could not get user location');
    });

    const searchLocation = async (query) => {
      if (!query || query.length < 3) return [];
      try {
        // Add proximity bias if user location is available
        let url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=5`;
        if (this.userLocation) {
          url += `&proximity=${this.userLocation.lng},${this.userLocation.lat}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        return data.features || [];
      } catch (error) {
        console.error('Geocoding error:', error);
        return [];
      }
    };

    const showSuggestions = (input, dropdown, results) => {
      dropdown.innerHTML = '';
      if (results.length === 0) {
        dropdown.style.display = 'none';
        return;
      }

      results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = result.place_name || result.text;
        div.dataset.coords = JSON.stringify(result.center);
        div.addEventListener('click', () => {
          input.value = result.place_name || result.text;
          input.dataset.coords = JSON.stringify(result.center); // Store coordinates
          dropdown.style.display = 'none';
          
          // Update map markers when location is selected
          this.updateMapMarkers();
          this.updateFareEstimate();
        });
        dropdown.appendChild(div);
      });

      dropdown.style.display = 'block';
    };

    pickupInput?.addEventListener('input', (e) => {
      clearTimeout(pickupTimeout);
      const query = e.target.value;
      if (query.length < 3) {
        pickupDropdown.style.display = 'none';
        return;
      }
      pickupTimeout = setTimeout(async () => {
        const results = await searchLocation(query);
        showSuggestions(pickupInput, pickupDropdown, results);
      }, 300);
    });

    dropInput?.addEventListener('input', (e) => {
      clearTimeout(dropTimeout);
      const query = e.target.value;
      if (query.length < 3) {
        dropDropdown.style.display = 'none';
        return;
      }
      dropTimeout = setTimeout(async () => {
        const results = await searchLocation(query);
        showSuggestions(dropInput, dropDropdown, results);
      }, 300);
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        pickupDropdown.style.display = 'none';
        dropDropdown.style.display = 'none';
      }
    });
  }

  highlightInitialSettings() {
    document.querySelectorAll('[data-map-style]').forEach(btn => {
      const style = btn.getAttribute('data-map-style');
      btn.classList.toggle('active', style === this.currentMapStyle);
    });
    document.querySelectorAll('[data-theme]').forEach(btn => {
      const theme = btn.getAttribute('data-theme');
      btn.classList.toggle('active', theme === this.currentTheme);
    });
  }

  async loadUserData() {
    try {
      const userData = await this.api.getUserProfile();
      this.updateProfileDisplay(userData);
      
      // Load additional data
      await Promise.all([
        this.loadRideHistory(),
        this.loadRewardPoints(),
        this.loadScheduledRides(),
        this.loadNotifications(),
        this.loadAnalytics()
      ]);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  updateProfileDisplay(userData) {
    const user = userData.user || userData;
    const name = user.name || user.username || 'User';
    const phone = user.phone || user.mobile || 'Not provided';
    
    const profileName = document.querySelector('.profile-name');
    profileName && (profileName.textContent = name);

    const profileNameLarge = document.getElementById('profileNameLarge');
    const profilePhone = document.getElementById('profilePhone');

    profileNameLarge && (profileNameLarge.textContent = name);
    profilePhone && (profilePhone.textContent = phone);

    const initials = this.getInitials(name);
    document.querySelectorAll('.profile-avatar, .profile-avatar-large').forEach(avatar => {
      avatar.textContent = initials;
    });
  }

  getInitials(name) {
    if (!name) return 'U';
    const parts = name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  async handleRideRequest() {
    const pickupInput = document.getElementById('pickupInput');
    const dropInput = document.getElementById('dropInput');
    const pickup = pickupInput.value;
    const drop = dropInput.value;
    const rideType = document.getElementById('rideTypeSelect').value;

    if (!pickup || !drop) {
      this.notificationManager.show('Please enter pickup and drop locations', 'error');
      return;
    }

    // Get coordinates from inputs
    const pickupCoords = pickupInput.dataset.coords;
    const dropCoords = dropInput.dataset.coords;

    if (!pickupCoords || !dropCoords) {
      this.notificationManager.show('Please select locations from the dropdown', 'error');
      return;
    }

    try {
      // Clear any old ride data
      this.rideManager.currentRide = null;
      this.currentRideId = null;
      localStorage.removeItem('currentRideId');
      localStorage.removeItem('currentRideData');
      
      this.updateRideStatus('searching');
      this.notificationManager.show('Searching for nearby drivers...', 'info');
      
      // Make actual API call to backend
      const response = await this.api.requestRide({
        pickup: pickup,
        drop: drop,
        rideType: rideType
      });

      if (!response.success) {
        // If error is about existing active ride, reload to show it
        if (response.message && response.message.includes('active ride')) {
          this.updateRideStatus('idle');
          await this.loadCurrentRide();
        }
        throw new Error(response.message || 'Failed to request ride');
      }

      const ride = response.ride;
      console.log('✅ Ride requested successfully:', ride);
      
      // Store ride ID for tracking
      this.currentRideId = ride._id;
      
      // Show searching state
      this.notificationManager.show('Ride request sent to nearby drivers', 'success');
      
      // Store basic ride data
      try {
        localStorage.setItem('currentRideId', ride._id);
        localStorage.setItem('currentRideData', JSON.stringify(ride));
      } catch (e) {
        console.error('Failed to store ride data:', e);
      }
      
      // Start the ride in searching state
      this.rideManager.startRide(ride);
      this.showCurrentRideCard(ride);
      
      // Subscribe to ride updates via socket
      if (this.socketManager && this.socketManager.isConnected()) {
        this.socketManager.subscribeToRide(ride._id);
        console.log(`✅ Subscribed to ride ${ride._id} updates`);
      }
      
    } catch (error) {
      console.error('Ride request failed:', error);
      this.updateRideStatus('idle');
      this.notificationManager.show(error.message || 'Failed to request ride. Please try again.', 'error');
    }
  }

  async updateFareEstimate() {
    const rideType = document.getElementById('rideTypeSelect').value;
    const pickupInput = document.getElementById('pickupInput');
    const dropInput = document.getElementById('dropInput');
    const pickup = pickupInput?.value;
    const drop = dropInput?.value;
    const fareAmount = document.getElementById('fareAmount');

    if (!pickup || !drop) {
      const fares = {
        economy: '₹120 - ₹150',
        comfort: '₹180 - ₹220',
        premium: '₹250 - ₹300',
        shared: '₹80 - ₹100'
      };
      fareAmount && (fareAmount.textContent = fares[rideType] || 'Enter locations');
      return;
    }

    // Get coordinates from dataset
    const pickupCoords = pickupInput?.dataset.coords;
    const dropCoords = dropInput?.dataset.coords;

    if (!pickupCoords || !dropCoords) {
      fareAmount && (fareAmount.textContent = 'Select from dropdown');
      return;
    }

    try {
      const pickup_coords = JSON.parse(pickupCoords);
      const drop_coords = JSON.parse(dropCoords);

      fareAmount && (fareAmount.textContent = 'Calculating...');

      // Get real road route distance using OSRM API
      const routeData = await this.getRealRoadRoute(
        pickup_coords[1], pickup_coords[0], // lat, lng
        drop_coords[1], drop_coords[0]
      );

      // Use real road distance
      const distance = routeData.distance;
      const routeCoordinates = routeData.coordinates;
      const duration = routeData.duration;

      // Calculate fare based on real distance and ride type
      const fare = this.calculateFare(distance, rideType);
      
      fareAmount && (fareAmount.textContent = `₹${Math.round(fare)} (${distance.toFixed(1)} km)`);
      
      // Store for later use (including route coordinates)
      this.estimatedFare = fare;
      this.estimatedDistance = distance;
      this.routeCoordinates = routeCoordinates;
      this.estimatedDuration = duration;
      
      console.log('🛣️ Real road route:', { distance, duration, fare });
      
    } catch (error) {
      console.error('Failed to estimate fare:', error);
      // Fallback to straight-line distance
      try {
        const pickup_coords = JSON.parse(pickupCoords);
        const drop_coords = JSON.parse(dropCoords);
        const distance = this.calculateDistance(
          pickup_coords[1], pickup_coords[0],
          drop_coords[1], drop_coords[0]
        );
        const fare = this.calculateFare(distance, rideType);
        fareAmount && (fareAmount.textContent = `₹${Math.round(fare)} (${distance.toFixed(1)} km)`);
        this.estimatedFare = fare;
        this.estimatedDistance = distance;
      } catch (fallbackError) {
        fareAmount && (fareAmount.textContent = '₹--');
      }
    }
  }

  // Get real road route using OSRM API
  async getRealRoadRoute(startLat, startLng, endLat, endLng) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        return {
          distance: route.distance / 1000, // Convert meters to km
          duration: route.duration / 60, // Convert seconds to minutes
          coordinates: route.geometry.coordinates // Array of [lng, lat]
        };
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      console.error('OSRM routing error:', error);
      // Fallback to straight-line distance
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      return {
        distance: distance,
        duration: (distance / 30) * 60, // Assume 30 km/h average
        coordinates: [[startLng, startLat], [endLng, endLat]]
      };
    }
  }

  // Haversine formula to calculate distance between two coordinates
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Calculate fare based on distance and ride type
  calculateFare(distanceKm, rideType) {
    const baseFares = {
      economy: { base: 50, perKm: 12 },
      comfort: { base: 80, perKm: 18 },
      premium: { base: 120, perKm: 25 },
      shared: { base: 30, perKm: 8 }
    };

    const rates = baseFares[rideType] || baseFares.economy;
    const fare = rates.base + (distanceKm * rates.perKm);
    
    // Add surge pricing during peak hours (optional)
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
    const surgeFare = isPeakHour ? fare * 1.5 : fare;
    
    return surgeFare;
  }

  async loadCurrentRide() {
    try {
      const response = await this.api.getCurrentRide();
      
      // Only restore ride if it has a driver assigned and is in active state
      // Don't show rides that are just 'searching' - those will be handled by new requests
      if (response.ride && 
          response.ride.status !== 'completed' && 
          response.ride.status !== 'cancelled' &&
          response.ride.status !== 'searching' &&
          response.ride.driver) {
        
        const ride = response.ride;
        
        // Restore ride data to rideManager
        this.rideManager.currentRide = {
          id: ride._id,
          pickup: ride.pickupLocation?.address || 'Unknown',
          drop: ride.dropoffLocation?.address || 'Unknown',
          rideType: ride.rideType,
          fare: ride.fare,
          driver: ride.driver,
          status: ride.status,
          requestedAt: new Date(ride.createdAt),
          startedAt: ride.startedAt ? new Date(ride.startedAt) : null,
          completedAt: ride.completedAt ? new Date(ride.completedAt) : null
        };
        
        // Update UI
        this.showCurrentRideCard(ride);
        this.updateRideStatus(ride.status);
        
        console.log('✅ Restored active ride with driver:', this.rideManager.currentRide);
      }
    } catch (error) {
      console.error('Failed to load current ride:', error);
      // Don't show error to user - it's normal to not have an active ride
    }
  }

  async loadRideHistory() {
    try {
      const response = await this.api.getRideHistory(1, 10);
      const rides = response.items || [];
      
      const historyList = document.getElementById('historyList');
      if (!historyList) return;

      if (rides.length === 0) {
        historyList.innerHTML = '<p class="empty-state" style="text-align: center; color: #999; padding: 20px;">No ride history yet</p>';
        return;
      }

      historyList.innerHTML = '';
      rides.forEach(ride => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const date = new Date(ride.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const pickup = ride.pickupLocation?.address || 'Unknown';
        const drop = ride.dropoffLocation?.address || 'Unknown';
        const distance = ride.distanceKm || 0;
        const fare = ride.fare || 0;
        
        historyItem.innerHTML = `
          <div class="history-icon">🚕</div>
          <div class="history-details">
            <p class="history-route">${pickup} → ${drop}</p>
            <p class="history-meta">${date} • ${distance} km • ₹${fare}</p>
          </div>
          <button class="btn-invoice" data-ride-id="${ride._id}">📄</button>
        `;
        historyList.appendChild(historyItem);
      });

      // Add invoice button listeners
      document.querySelectorAll('.btn-invoice').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const rideId = e.target.getAttribute('data-ride-id');
          this.downloadInvoice(rideId);
        });
      });
    } catch (error) {
      console.error('Failed to load ride history:', error);
    }
  }

  async loadRewardPoints() {
    try {
      const response = await this.api.getRewardPoints();
      const points = response.points || 0;
      
      const rewardPointsEl = document.getElementById('rewardPoints');
      if (rewardPointsEl) {
        rewardPointsEl.textContent = points;
      }
    } catch (error) {
      console.error('Failed to load reward points:', error);
    }
  }

  async loadScheduledRides() {
    try {
      const response = await this.api.getScheduledRides();
      const rides = response.rides || [];
      
      const prebookingList = document.getElementById('prebookingList');
      if (!prebookingList) return;

      if (rides.length === 0) {
        prebookingList.innerHTML = '<p class="empty-state" style="text-align: center; color: #999; padding: 20px;">No scheduled rides</p>';
        return;
      }

      prebookingList.innerHTML = '';
      rides.forEach(ride => {
        const scheduleDate = new Date(ride.scheduledAt);
        const day = scheduleDate.getDate();
        const month = scheduleDate.toLocaleDateString('en-US', { month: 'short' });
        const time = scheduleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        const pickup = ride.pickupLocation?.address || 'Unknown';
        const drop = ride.dropoffLocation?.address || 'Unknown';
        
        let recurringLabel = '';
        if (ride.isRecurring) {
          if (ride.recurringDays?.length === 7) {
            recurringLabel = '<span style="color: #3498db; font-size: 11px;">🔁 Daily</span>';
          } else if (ride.recurringDays?.length === 5) {
            recurringLabel = '<span style="color: #3498db; font-size: 11px;">🔁 Weekdays</span>';
          } else if (ride.recurringDays?.length === 2) {
            recurringLabel = '<span style="color: #3498db; font-size: 11px;">🔁 Weekends</span>';
          }
        }
        
        const prebookingItem = document.createElement('div');
        prebookingItem.className = 'prebooking-item';
        prebookingItem.innerHTML = `
          <div class="prebooking-date">
            <span class="date-day">${day}</span>
            <span class="date-month">${month}</span>
          </div>
          <div class="prebooking-details">
            <p class="prebooking-route">${pickup} → ${drop}</p>
            <p class="prebooking-time">${time} ${recurringLabel}</p>
          </div>
        `;
        prebookingList.appendChild(prebookingItem);
      });
    } catch (error) {
      console.error('Failed to load scheduled rides:', error);
    }
  }

  async loadNotifications() {
    try {
      const response = await this.api.getNotifications();
      const notifications = response.notifications || [];
      
      if (notifications.length > 0) {
        notifications.forEach(notif => {
          this.notificationManager.addNotification({
            id: notif._id,
            title: notif.title,
            message: notif.message,
            icon: notif.icon || '📢',
            timestamp: notif.createdAt,
            read: notif.read || false
          });
        });
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  async loadAnalytics() {
    try {
      const response = await this.api.getRideAnalytics();
      const series = response.series || {};
      
      const canvas = document.getElementById('analyticsChart');
      if (!canvas) return;

      const labels = series.labels || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const rides = series.rides || [0, 0, 0, 0, 0, 0, 0];
      
      const data = {
        labels: labels,
        datasets: [{
          label: 'Rides (last 7 days)',
          data: rides,
          fill: true,
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderColor: 'rgba(59,130,246,1)',
          tension: 0.3,
          pointRadius: 4
        }]
      };

      new Chart(canvas, {
        type: 'line',
        data: data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            tooltip: { mode: 'index', intersect: false }
          },
          scales: {
            x: { display: true },
            y: { beginAtZero: true }
          }
        }
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  async downloadInvoice(rideId) {
    try {
      const blob = await this.api.downloadInvoice(rideId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${rideId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      this.notificationManager.show('Failed to download invoice', 'error');
    }
  }

  showCurrentRideCard(rideData) {
    const currentRideCard = document.getElementById('currentRideCard');
    const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
    const cancelRideBtn = document.getElementById('cancelRideBtn');
    
    if (currentRideCard) {
      currentRideCard.style.display = 'block';
      
      const driverName = document.getElementById('driverName');
      const driverAvatar = document.getElementById('driverAvatar');
      const driverRating = document.getElementById('driverRating');
      
      // Update driver info ONLY if driver is assigned and status is not 'searching'
      if (rideData.driver && rideData.status !== 'searching') {
        if (driverName) driverName.textContent = rideData.driver.name || 'Driver';
        if (driverAvatar) driverAvatar.textContent = this.getInitials(rideData.driver.name || 'D');
        if (driverRating) {
          const rating = rideData.driver.rating || 0;
          const vehicle = rideData.driver.vehicle?.model || 'Vehicle';
          driverRating.textContent = `⭐ ${rating} • ${vehicle}`;
        }
        
        // Enable "View Live Ride" button when driver is assigned
        if (viewLiveRideBtn) {
          viewLiveRideBtn.disabled = false;
          viewLiveRideBtn.style.opacity = '1';
          viewLiveRideBtn.style.cursor = 'pointer';
        }
      } else {
        // Clear driver info when searching
        if (driverName) driverName.textContent = 'Searching...';
        if (driverAvatar) driverAvatar.textContent = '🔍';
        if (driverRating) driverRating.textContent = 'Finding your driver';
        
        // Disable button when searching for driver
        if (viewLiveRideBtn) {
          viewLiveRideBtn.disabled = true;
          viewLiveRideBtn.style.opacity = '0.5';
          viewLiveRideBtn.style.cursor = 'not-allowed';
        }
      }
      
      // Always enable "Cancel Ride" button - users can cancel at any status
      if (cancelRideBtn) {
        cancelRideBtn.disabled = false;
        cancelRideBtn.style.opacity = '1';
        cancelRideBtn.style.cursor = 'pointer';
      }
      
      setTimeout(() => {
        currentRideCard.style.animation = 'slideUp 0.5s ease-out';
      }, 100);
    }
  }

  updateRideStatus(status) {
    const statusSteps = document.querySelectorAll('.status-step');
    const statusMap = { searching: 0, assigned: 1, arriving: 2, on_trip: 3, completed: 4 };

    statusSteps.forEach((step, index) => {
      step.classList.toggle('active', index <= (statusMap[status] || 0));
    });

    const rideStatus = document.getElementById('rideStatus');
    const statusTexts = {
      searching: 'Searching for driver...',
      assigned: 'Driver assigned',
      arriving: 'Driver arriving',
      on_trip: 'On trip',
      completed: 'Ride completed'
    };

    if (rideStatus) {
      rideStatus.textContent = statusTexts[status] || 'Status unknown';
      rideStatus.className = `status-badge ${status}`;
    }
  }

  async handleCancelRide() {
    if (!confirm('Are you sure you want to cancel this ride?')) return;

    try {
      console.log('🔍 DEBUG: handleCancelRide called');
      console.log('🔍 DEBUG: currentRide:', this.rideManager.currentRide);
      
      // Check if there's a current ride to cancel
      if (!this.rideManager.currentRide || !this.rideManager.currentRide.id) {
        console.error('❌ DEBUG: No currentRide or no ID');
        throw new Error('No active ride to cancel');
      }

      console.log('🔍 DEBUG: Attempting to cancel ride with ID:', this.rideManager.currentRide.id);
      await this.api.cancelRide(this.rideManager.currentRide.id);
      console.log('✅ DEBUG: Cancel API call successful');
      
      this.rideManager.endRide();

      const currentRideCard = document.getElementById('currentRideCard');
      currentRideCard && (currentRideCard.style.display = 'none');

      this.updateRideStatus('searching');
      this.notificationManager.show('Ride cancelled successfully', 'success');
    } catch (error) {
      console.error('❌ Failed to cancel ride:', error);
      console.error('❌ Error details:', error.message);
      this.notificationManager.show('Failed to cancel ride', 'error');
    }
  }

  navigateToLiveRide() {
    const currentRide = this.rideManager.currentRide;
    
    console.log('🔍 Navigating to live ride page');
    console.log('🔍 Current ride data:', currentRide);
    
    if (!currentRide || !currentRide.id) {
      this.notificationManager.show('No active ride to view', 'error');
      console.error('❌ No active ride found');
      return;
    }

    // DON'T overwrite localStorage here - the full ride data with coordinates
    // was already stored when the ride was created/booked
    // Just navigate with ride ID
    try {
      const url = `live-ride.html?rideId=${currentRide.id}`;
      console.log('🔗 Navigating to:', url);
      console.log('✅ Full ride data with coordinates is already in localStorage');
      window.location.href = url;
    } catch (error) {
      console.error('❌ Failed to navigate to live ride:', error);
      this.notificationManager.show('Failed to open live ride view', 'error');
    }
  }

  // ===== MAP (Leaflet + multiple styles) =====
  initMap() {
    // MapTiler key - in production, serve this from backend config endpoint
    const MAPTILER_KEY = 't1z6B2LZrqsUyffdHC1I';

    if (typeof L === 'undefined') {
      console.error('❌ Leaflet is not loaded');
      return null;
    }

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
      console.error('❌ Map container not found');
      return null;
    }

    try {
      // Default to Bangalore, will be updated with user location
      const map = L.map('mapContainer').setView([12.9716, 77.5946], 13);
      console.log('✅ Map object created');
    
      // Get user's current location
      this.getUserLocation(map);

      const baseLayers = {
        light: L.tileLayer(
          `https://api.maptiler.com/maps/basic/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            attribution: '&copy; MapTiler & OpenStreetMap contributors'
          }
        ),
        dark: L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; OpenStreetMap & CartoDB'
          }
        ),
        terrain: L.tileLayer(
          'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
          {
            attribution: '&copy; OpenStreetMap & Stamen Design'
          }
        ),
        satellite: L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/' +
          'World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '&copy; Esri & OpenStreetMap contributors'
          }
        )
      };

      // Add initial style
      const initialStyle = baseLayers[this.currentMapStyle] ? this.currentMapStyle : 'light';
      baseLayers[initialStyle].addTo(map);

      const pickupMarker = L.marker([12.9716, 77.5946]).addTo(map);
      const driverMarker = L.marker([12.975, 77.600]).addTo(map);

      setTimeout(() => {
        try { map.invalidateSize(); } catch (e) {}
      }, 300);

      return { map, pickupMarker, driverMarker, baseLayers };
    } catch (error) {
      console.error('❌ Map initialization failed:', error);
      return null;
    }
  }

  getUserLocation(map) {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Update map view to user's current location
          map.setView([lat, lng], 13);
          
          // Update pickup marker to user's location
          if (this.mapState && this.mapState.pickupMarker) {
            this.mapState.pickupMarker.setLatLng([lat, lng]);
            this.mapState.pickupMarker.bindPopup('📍 Your Location').openPopup();
          }
          
          // Move drop marker slightly away from pickup
          if (this.mapState && this.mapState.driverMarker) {
            this.mapState.driverMarker.setLatLng([lat + 0.01, lng + 0.01]);
            this.mapState.driverMarker.bindPopup('🎯 Drop Location');
          }
          
          console.log('📍 User location set on map:', lat, lng);
          
          // Store user location for later use
          this.userLocation = { lat, lng };
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          console.log('Using default location (Bangalore)');
          // Keep default Bangalore location if geolocation fails
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      console.warn('Geolocation not supported');
    }
  }

  setMapStyle(style) {
    const ms = this.mapState;
    if (!ms || !ms.baseLayers || !ms.map) return;

    if (!ms.baseLayers[style]) style = 'light';

    Object.values(ms.baseLayers).forEach(layer => {
      if (ms.map.hasLayer(layer)) {
        ms.map.removeLayer(layer);
      }
    });

    ms.baseLayers[style].addTo(ms.map);
    this.currentMapStyle = style;

    try {
      localStorage.setItem('rr_map_style', style);
    } catch (e) {}
  }

  // Driver movement for Leaflet
  updateDriverMarker(location) {
    const ms = this.mapState;
    if (!ms || !ms.driverMarker) return;

    let lat, lng;
    if (Array.isArray(location)) [lat, lng] = location;
    else {
      lat = location.lat ?? location.latitude ?? location[0];
      lng = location.lng ?? location.longitude ?? location[1];
    }

    if (lat == null || lng == null) return;

    ms.driverMarker.setLatLng([lat, lng]);
    ms.map.panTo([lat, lng]);
  }

  // Update map markers when pickup/drop locations are selected
  updateMapMarkers() {
    const pickupInput = document.getElementById('pickupInput');
    const dropInput = document.getElementById('dropInput');
    
    const pickupCoords = pickupInput?.dataset.coords;
    const dropCoords = dropInput?.dataset.coords;
    
    if (!this.mapState || !this.mapState.map) {
      console.warn('Map not initialized yet');
      return;
    }
    
    try {
      // Update pickup marker if pickup is selected
      if (pickupCoords) {
        const coords = JSON.parse(pickupCoords);
        const lat = coords[1]; // [lng, lat] format
        const lng = coords[0];
        
        if (this.mapState.pickupMarker) {
          this.mapState.pickupMarker.setLatLng([lat, lng]);
          console.log('📍 Pickup marker moved to:', lat, lng);
        }
      }
      
      // Update drop marker if drop is selected
      if (dropCoords) {
        const coords = JSON.parse(dropCoords);
        const lat = coords[1];
        const lng = coords[0];
        
        if (this.mapState.driverMarker) {
          // Use driver marker as drop marker for now
          this.mapState.driverMarker.setLatLng([lat, lng]);
          console.log('🎯 Drop marker moved to:', lat, lng);
        }
      }
      
      // If both locations selected, fit map to show both markers
      if (pickupCoords && dropCoords) {
        const pickup = JSON.parse(pickupCoords);
        const drop = JSON.parse(dropCoords);
        
        const bounds = L.latLngBounds([
          [pickup[1], pickup[0]], // pickup
          [drop[1], drop[0]]       // drop
        ]);
        
        this.mapState.map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13
        });
        
        console.log('🗺️ Map fitted to show both locations');
      } else if (pickupCoords) {
        // Just pickup selected, center on it
        const coords = JSON.parse(pickupCoords);
        this.mapState.map.setView([coords[1], coords[0]], 13);
        console.log('🗺️ Map centered on pickup');
      } else if (dropCoords) {
        // Just drop selected, center on it
        const coords = JSON.parse(dropCoords);
        this.mapState.map.setView([coords[1], coords[0]], 13);
        console.log('🗺️ Map centered on drop');
      }
    } catch (error) {
      console.error('Error updating map markers:', error);
    }
  }

  // ===== SOCKET EVENTS =====
  setupSocketListeners() {
    // Listen for ride status changes (from driver acceptance)
    this.socketManager.on('ride:status_changed', data => {
      console.log('🔔 Ride status changed:', data);
      
      if (data.status === 'assigned' && data.ride) {
        this.updateRideStatus('assigned');
        
        const driverName = data.ride.driver?.name || 'A driver';
        this.notificationManager.show(`${driverName} accepted your ride!`, 'success');
        
        // Update ride manager with driver info
        if (this.rideManager.currentRide && data.ride.driver) {
          this.rideManager.currentRide.driver = data.ride.driver;
          
          // Update localStorage with full ride data including driver
          try {
            localStorage.setItem('currentRideData', JSON.stringify(data.ride));
          } catch (e) {
            console.error('Failed to update ride data:', e);
          }
        }
        
        // Enable the "View Live Ride" button
        const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
        if (viewLiveRideBtn) {
          viewLiveRideBtn.disabled = false;
          viewLiveRideBtn.style.opacity = '1';
          viewLiveRideBtn.style.cursor = 'pointer';
        }
        
        // Auto-navigate after 2 seconds
        setTimeout(() => {
          const currentRide = this.rideManager.currentRide;
          if (currentRide && currentRide.id) {
            console.log('🔄 Auto-navigating to live ride page...');
            this.navigateToLiveRide();
          }
        }, 2000);
      }
    });
    
    // Legacy driver_assigned event (keep for backward compatibility)
    this.socketManager.on('driver_assigned', data => {
      console.log('🚗 Driver assigned event received (legacy):', data);
      this.updateRideStatus('assigned');
      this.notificationManager.show(`Driver ${data.driverName} assigned - Click "View Live Ride" to track`, 'success');
      
      // Update ride manager with driver info
      if (this.rideManager.currentRide) {
        this.rideManager.currentRide.driver = data.driver || {
          name: data.driverName,
          vehicle: data.vehicle,
          rating: data.rating
        };
      }
      
      // Enable the "View Live Ride" button
      const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
      if (viewLiveRideBtn) {
        viewLiveRideBtn.disabled = false;
        viewLiveRideBtn.style.opacity = '1';
        viewLiveRideBtn.style.cursor = 'pointer';
      }
    });

    this.socketManager.on('driver_arriving', data => {
      this.updateRideStatus('arriving');
      this.startETACountdown(data.eta);
    });

    this.socketManager.on('trip_started', () => {
      this.updateRideStatus('on_trip');
      this.notificationManager.show('Trip started', 'info');
    });

    this.socketManager.on('trip_completed', data => {
      this.updateRideStatus('completed');
      this.notificationManager.show('Trip completed successfully', 'success');
      this.showTripSummary(data);
    });

    this.socketManager.on('driver_location_update', data => {
      this.updateDriverMarker(data.location);
    });

    this.socketManager.on('route_deviation', () => {
      const deviationModal = document.getElementById('deviationModal');
      deviationModal && deviationModal.classList.add('active');
    });

    this.socketManager.on('notification', (data) => {
      this.notificationManager.addNotification(data);
    });
  }

  // ===== ETA, HISTORY, SUPPORT, LOGOUT =====
  startETACountdown(initialETA) {
    const etaElement = document.getElementById('etaCountdown');
    if (!etaElement) return;

    let remainingMinutes = initialETA;

    if (this.etaInterval) {
      clearInterval(this.etaInterval);
    }

    this.etaInterval = setInterval(() => {
      if (remainingMinutes > 0) {
        etaElement.textContent = `${remainingMinutes} mins`;
        remainingMinutes--;
      } else {
        etaElement.textContent = 'Arriving now';
        clearInterval(this.etaInterval);
      }
    }, 60000);
  }

  showTripSummary(data) {
    const currentRideCard = document.getElementById('currentRideCard');
    if (currentRideCard) {
      currentRideCard.style.display = 'none';
    }

    this.notificationManager.show(
      `Ride completed! Distance: ${data.distance}km, Fare: ₹${data.fare}`,
      'success'
    );

    this.addToRideHistory(data);
  }

  addToRideHistory(rideData) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.style.animation = 'slideUp 0.5s ease-out';
    
    historyItem.innerHTML = `
      <div class="history-icon">🚕</div>
      <div class="history-details">
        <p class="history-route">${rideData.pickup} → ${rideData.drop}</p>
        <p class="history-meta">${new Date().toLocaleDateString()} • ${rideData.distance} km • ₹${rideData.fare}</p>
      </div>
      <button class="btn-invoice">📄</button>
    `;

    historyList.insertBefore(historyItem, historyList.firstChild);
  }

  contactDriver() {
    this.notificationManager.show('Calling driver...', 'info');

    const deviationModal = document.getElementById('deviationModal');
    deviationModal && deviationModal.classList.remove('active');

    setTimeout(() => {
      this.notificationManager.show('Call connected', 'success');
    }, 1000);
  }

  async handleReportIssue() {
    const issueType = document.getElementById('issueTypeSelect').value;
    const description = document.getElementById('issueDescription').value;

    if (!issueType || !description) {
      this.notificationManager.show('Please fill in all fields', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE}/rider/support/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('rapidride_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          issueType,
          description
        })
      });

      if (response.ok) {
        this.notificationManager.show('Issue reported successfully. We will get back to you soon.', 'success');
        document.getElementById('reportIssueForm').reset();
      } else {
        this.notificationManager.show('Failed to submit issue. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Report issue error:', error);
      this.notificationManager.show('Failed to submit issue. Please try again.', 'error');
    }
  }

  handleLogout() {
    const logoutModal = document.getElementById('logoutModal');
    logoutModal?.classList.add('active');
  }

  confirmLogout() {
    localStorage.removeItem('token');
    window.location.href = '../../login.html';
  }

  async handleScheduleRide() {
    const pickup = document.getElementById('schedulePickupInput').value;
    const drop = document.getElementById('scheduleDropInput').value;
    const time = document.getElementById('scheduleDateTimeInput').value;
    const rideType = document.getElementById('scheduleRideTypeSelect').value;
    const recurrence = document.getElementById('scheduleRecurrenceSelect').value;

    if (!pickup || !drop || !time) {
      this.notificationManager.show('Please fill all fields', 'error');
      return;
    }

    // Create datetime from time input
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledTime = new Date();
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // If time has passed today and it's one-time, schedule for tomorrow
    if (recurrence === 'once' && scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    try {
      const response = await this.api.scheduleRide({
        pickup,
        drop,
        rideType,
        scheduledAt: scheduledTime.toISOString(),
        recurrence
      });

      if (response.success) {
        this.notificationManager.show('Ride scheduled successfully!', 'success');
        document.getElementById('scheduleRideModal').classList.remove('active');
        document.getElementById('scheduleRideForm').reset();
        this.loadScheduledRides();
      } else {
        this.notificationManager.show(response.message || 'Failed to schedule ride', 'error');
      }
    } catch (error) {
      console.error('Schedule ride error:', error);
      this.notificationManager.show('Failed to schedule ride', 'error');
    }
  }

  // ===== SOS =====
  triggerSOS() {
    console.log('🆘 SOS TRIGGERED');
    this.socketManager.emit('sos_alert', {
      riderId: 'current_rider_id',
      location: 'current_location',
      timestamp: new Date().toISOString()
    });
    
    this.notificationManager.show('Emergency services have been notified', 'warning');

    document.body.style.animation = 'flash 0.5s';
    setTimeout(() => {
      document.body.style.animation = '';
    }, 500);
  }

  // ===== THEME HANDLING =====
  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    this.currentTheme = theme;
    try {
      localStorage.setItem('rr_theme', theme);
    } catch (e) {}
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new DashboardController();
  console.log('🚀 RapidRide Dashboard initialized with Leaflet + theme & map styles');
});

export default DashboardController;

