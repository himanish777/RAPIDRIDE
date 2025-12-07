// Live Ride Tracking Module
import { API } from './api.js';
import { GeocodingService } from './geocoding.js';

class LiveRideTracker {
  constructor() {
    this.api = new API();
    this.geocodingService = new GeocodingService();
    this.socket = null;
    this.map = null;
    this.driverMarker = null;
    this.pickupMarker = null;
    this.dropMarker = null;
    this.myLocationMarker = null;
    this.routeLine = null;
    this.rideId = null;
    this.currentRide = null;
    this.etaInterval = null;
    this.watchId = null;
    this.myLocation = null;
    this.rideDataFromUrl = null;
    
    // New properties for enhanced functionality
    this.pickupCoords = null;
    this.dropCoords = null;
    this.driverCoords = null;
    this.routeData = null;
    this.animationFrame = null;
    this.lastDriverUpdate = null;
    this.trafficLevel = 'low'; // low, medium, heavy
    this.debugLogs = [];
    
    this.init();
  }
  
  // Debug logging to on-screen console
  debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '#0f0',
      warn: '#ff0',
      error: '#f00',
      success: '#0ff'
    };
    const color = colors[type] || colors.info;
    
    this.debugLogs.push(`<div style="color: ${color}; margin: 2px 0;">[${timestamp}] ${message}</div>`);
    
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
      debugContent.innerHTML = this.debugLogs.slice(-15).join('');
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }

  init() {
    // Get ride ID and data from URL params
    const urlParams = new URLSearchParams(window.location.search);
    this.rideId = urlParams.get('rideId');
    
    if (!this.rideId) {
      this.showToast('No ride ID provided');
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 2000);
      return;
    }

    // Extract ride data from URL params
    this.rideDataFromUrl = {
      pickupLat: parseFloat(urlParams.get('pickupLat')),
      pickupLng: parseFloat(urlParams.get('pickupLng')),
      dropLat: parseFloat(urlParams.get('dropLat')),
      dropLng: parseFloat(urlParams.get('dropLng')),
      pickup: urlParams.get('pickup'),
      drop: urlParams.get('drop'),
      distance: parseFloat(urlParams.get('distance')),
      fare: parseFloat(urlParams.get('fare')),
      rideType: urlParams.get('rideType')
    };

    // Try to get full ride data from localStorage (includes route coordinates)
    try {
      const storedRideData = localStorage.getItem('currentRideData');
      if (storedRideData) {
        const parsedData = JSON.parse(storedRideData);
        // Merge with URL data, localStorage has priority for route info
        this.rideDataFromUrl = {
          ...this.rideDataFromUrl,
          routeCoordinates: parsedData.routeCoordinates,
          routeGeometry: parsedData.routeGeometry,
          duration: parsedData.duration
        };
      }
    } catch (e) {
      console.warn('Could not load ride data from localStorage:', e);
    }

    this.initMap();
    this.setupEventListeners();
    this.connectSocket();
    
    // Wait for map to be fully ready before loading ride details
    setTimeout(() => {
      this.loadRideDetails();
    }, 500);
    
    this.startLocationTracking();
  }

  // Initialize Leaflet Map
  initMap() {
    console.log('🔧 Starting map initialization...');
    
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.error('❌ CRITICAL: Leaflet (L) is not defined!');
      alert('Map library not loaded. Please refresh the page.');
      return;
    }
    
    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('❌ CRITICAL: Map container #map not found!');
      alert('Map container not found. Please refresh the page.');
      return;
    }
    
    console.log('✅ Map container found:', mapContainer);
    console.log('✅ Leaflet version:', L.version);
    
    // Start with India view, will update when ride data loads
    this.map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: false, // Use SVG for better marker rendering
      renderer: L.svg({ padding: 0.5 })
    }).setView([20.5937, 78.9629], 5); // Start with India view

    console.log('✅ Map object created');

    // Add OpenStreetMap tiles
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 2
    }).addTo(this.map);

    // Add zoom control to bottom right
    this.map.zoomControl.setPosition('bottomright');
    
    // Wait for tiles to load
    tileLayer.on('load', () => {
      console.log('✅ Map tiles loaded successfully');
    });
    
    // Force map to render
    setTimeout(() => {
      this.map.invalidateSize();
      console.log('✅ Map size invalidated after init');
    }, 100);
    
    console.log('✅ Map initialized and ready');
  }

  // Start tracking user's live location
  startLocationTracking() {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser');
      this.showToast('⚠️ Geolocation not supported');
      return;
    }

    this.showToast('📍 Getting your location...');

    // Get initial position with high priority
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.myLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('Got user location:', this.myLocation);
        this.updateMyLocation(this.myLocation.lat, this.myLocation.lng);
        // DON'T center map here - let updateMapWithRide() handle bounds
        // to show pickup, drop, and driver together
        this.showToast('✅ Location found!');
        
        // Re-fit bounds if ride is already loaded to include user location
        if (this.currentRide && this.pickupMarker && this.dropMarker) {
          this.refitMapBounds();
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        this.showToast('❌ Unable to get your location - ' + error.message);
        // DON'T set map view here either - let ride data control the view
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    // Watch position for continuous updates
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.myLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.updateMyLocation(this.myLocation.lat, this.myLocation.lng);
        
        // Only refit bounds on first few updates to avoid constant map movement
        if (!this.locationUpdateCount) {
          this.locationUpdateCount = 0;
        }
        this.locationUpdateCount++;
        
        // Refit bounds only on 2nd update (after ride markers are placed)
        if (this.locationUpdateCount === 2 && this.pickupMarker && this.dropMarker) {
          console.log('🔄 Refitting bounds to include user location');
          this.refitMapBounds();
        }
      },
      (error) => {
        console.log('Error watching location:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }

  // Update user's location marker on map
  updateMyLocation(lat, lng) {
    if (!lat || !lng) return;

    // Remove old marker
    if (this.myLocationMarker) {
      this.map.removeLayer(this.myLocationMarker);
    }

    // Add new marker for user's location (blue dot with theme color)
    const myLocationIcon = L.divIcon({
      className: 'my-location-marker',
      html: `<div style="width: 22px; height: 22px; background: #3498db; border: 4px solid white; border-radius: 50%; box-shadow: 0 3px 12px rgba(52,152,219,0.5);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    this.myLocationMarker = L.marker([lat, lng], { icon: myLocationIcon })
      .addTo(this.map)
      .bindPopup('Your Location');
  }

  // Setup event listeners
  setupEventListeners() {
    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave? Your ride is still active.')) {
        window.location.href = './dashboard.html';
      }
    });

    // SOS Button
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

    // Share Ride
    const shareRideBtn = document.getElementById('shareRideBtn');
    const shareModal = document.getElementById('shareModal');
    const closeShareModal = document.getElementById('closeShareModal');
    const copyLinkBtn = document.getElementById('copyLinkBtn');

    shareRideBtn?.addEventListener('click', () => {
      this.generateShareLink();
      shareModal?.classList.add('active');
    });

    closeShareModal?.addEventListener('click', () => {
      shareModal?.classList.remove('active');
    });

    copyLinkBtn?.addEventListener('click', () => {
      const input = document.getElementById('shareLinkInput');
      input.select();
      document.execCommand('copy');
      this.showToast('Link copied to clipboard!');
    });

    document.getElementById('shareWhatsappBtn')?.addEventListener('click', () => {
      this.shareOnWhatsApp();
    });

    document.getElementById('shareSmsBtn')?.addEventListener('click', () => {
      this.shareViaSMS();
    });

    // Cancel Ride
    const cancelRideBtn = document.getElementById('cancelRideBtn');
    const cancelModal = document.getElementById('cancelModal');
    const closeCancelModal = document.getElementById('closeCancelModal');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const cancelCancelBtn = document.getElementById('cancelCancelBtn');

    cancelRideBtn?.addEventListener('click', () => {
      cancelModal?.classList.add('active');
    });

    closeCancelModal?.addEventListener('click', () => {
      cancelModal?.classList.remove('active');
    });

    cancelCancelBtn?.addEventListener('click', () => {
      cancelModal?.classList.remove('active');
    });

    confirmCancelBtn?.addEventListener('click', () => {
      this.cancelRide();
      cancelModal?.classList.remove('active');
    });

    // Driver actions
    document.getElementById('callDriverBtn')?.addEventListener('click', () => {
      this.callDriver();
    });

    document.getElementById('chatDriverBtn')?.addEventListener('click', () => {
      this.showToast('Chat feature coming soon!');
    });

    // My Location button
    const myLocationBtn = document.getElementById('myLocationBtn');
    myLocationBtn?.addEventListener('click', () => {
      this.centerOnMyLocation();
    });

    // Minimize/Maximize Floating Info Card
    const minimizeInfoBtn = document.getElementById('minimizeInfoBtn');
    const floatingInfoCard = document.getElementById('floatingInfoCard');
    minimizeInfoBtn?.addEventListener('click', () => {
      floatingInfoCard?.classList.toggle('minimized');
      if (floatingInfoCard?.classList.contains('minimized')) {
        minimizeInfoBtn.textContent = '+';
      } else {
        minimizeInfoBtn.textContent = '−';
      }
    });

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  // Connect to Socket.IO
  connectSocket() {
    try {
      const serverURL = window.location.origin;
      this.socket = io(serverURL, {
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
        if (this.rideId) {
          this.socket.emit('subscribe_ride', { rideId: this.rideId });
        }
      });

      this.socket.on('driver_location_update', (data) => {
        console.log('Driver location update:', data);
        this.updateDriverLocation(data.lat, data.lng);
      });

      this.socket.on('ride_status_update', (data) => {
        console.log('Ride status update:', data);
        if (data.rideId === this.rideId) {
          this.updateRideStatus(data.status);
        }
      });

      this.socket.on('driver_assigned', (data) => {
        console.log('Driver assigned:', data);
        if (data.rideId === this.rideId) {
          this.loadRideDetails();
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }

  // Load ride details from backend
  async loadRideDetails() {
    try {
      this.showLoading(true);
      
      // First, try to get ride data from localStorage (most reliable for mock rides)
      try {
        const storedRideData = localStorage.getItem('currentRideData');
        if (storedRideData) {
          const parsedRide = JSON.parse(storedRideData);
          console.log('✅ Loaded ride from localStorage:', parsedRide);
          console.log('📍 Pickup:', parsedRide.pickupLocation);
          console.log('🎯 Drop:', parsedRide.dropoffLocation);
          console.log('🛣️ Route coords:', parsedRide.routeCoordinates ? `${parsedRide.routeCoordinates.length} points` : 'none');
          
          // Use the stored ride data directly
          this.currentRide = parsedRide;
          this.showToast('✅ Ride tracking active');
          this.displayRideDetails();
          
          // Give map container MORE time to fully initialize before updating
          // Wait for map tiles to load
          setTimeout(() => {
            console.log('🗺️ About to update map with ride data...');
            this.updateMapWithRide();
          }, 800); // Increased delay for better rendering
          return; // Success, exit early
        }
      } catch (localStorageError) {
        console.warn('Could not load from localStorage:', localStorageError);
      }
      
      // Fallback: Load real ride data from URL params
      if (this.rideDataFromUrl && this.rideDataFromUrl.pickupLat) {
        console.log('📍 Creating ride from URL params');
        this.currentRide = this.createRideFromUrlData();
        this.showToast('✅ Ride tracking active');
        this.displayRideDetails();
        
        // Give map container MORE time to fully initialize before updating
        setTimeout(() => {
          console.log('🗺️ About to update map with ride data...');
          this.updateMapWithRide();
        }, 800); // Increased delay
        return;
      }
      
      // Last resort: Try to fetch from backend if rideId is provided
      if (this.rideId) {
        console.log('🔄 Fetching ride from backend...');
        try {
          const response = await this.api.request(`/rides/${this.rideId}`);
          
          if (response.success && response.ride) {
            this.currentRide = response.ride;
            this.displayRideDetails();
            this.updateMapWithRide();
            return;
          } else {
            throw new Error('Ride not found in backend');
          }
        } catch (apiError) {
          console.error('Failed to load ride from backend:', apiError);
          throw new Error('No ride data available from any source');
        }
      }
      
      // If we reach here, no data source worked
      throw new Error('No ride data available');
      
    } catch (error) {
      console.error('❌ Error loading ride:', error);
      this.showToast('Failed to load ride details - ' + error.message);
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 2000);
    } finally {
      this.showLoading(false);
    }
  }

  // Create ride data from URL parameters
  createRideFromUrlData() {
    const data = this.rideDataFromUrl;
    
    // Calculate a mock driver position (slightly before pickup for realism)
    // This ensures driver marker ALWAYS appears even for mock drivers
    const pickupLat = data.pickupLat;
    const pickupLng = data.pickupLng;
    
    // Place driver 0.01 degrees (~1km) away from pickup (northwest direction)
    const mockDriverLat = pickupLat + 0.008;
    const mockDriverLng = pickupLng - 0.006;
    
    console.log('🚗 Creating MOCK DRIVER at:', mockDriverLat, mockDriverLng);
    console.log('📍 Pickup at:', pickupLat, pickupLng);
    console.log('🎯 Drop at:', data.dropLat, data.dropLng);
    
    return {
      _id: this.rideId,
      status: 'assigned', // Changed from 'searching' to 'assigned' so driver appears
      pickupLocation: {
        address: data.pickup || 'Pickup Location',
        lat: data.pickupLat,
        lng: data.pickupLng
      },
      dropoffLocation: {
        address: data.drop || 'Drop Location',
        lat: data.dropLat,
        lng: data.dropLng
      },
      type: data.rideType || 'economy',
      fare: data.fare || 0,
      distance: data.distance || 0,
      rider: 'current-user',
      // ADD MOCK DRIVER WITH LOCATION
      driver: {
        _id: 'mock-driver-123',
        name: 'Rajesh Kumar',
        rating: 4.8,
        phone: '+91-9876543210',
        vehicle: {
          model: 'Honda City',
          number: 'KA-01-AB-1234',
          color: 'White'
        },
        location: {
          lat: mockDriverLat,
          lng: mockDriverLng,
          latitude: mockDriverLat, // Support both formats
          longitude: mockDriverLng
        }
      }
    };
  }

  // Mock methods removed - real driver tracking via Socket.IO
  // Driver location updates and ride status changes will be received
  // through Socket.IO events from the backend when a real driver is assigned

  // Display ride details on UI
  displayRideDetails() {
    const ride = this.currentRide;
    
    console.log('📋 Displaying ride details:', ride);
    
    // Update status
    this.updateRideStatus(ride.status);
    
    // Update addresses - handle both formats (pickup/drop and pickupLocation/dropoffLocation)
    const pickupAddress = ride.pickupLocation?.address || ride.pickup || 'Pickup location';
    const dropAddress = ride.dropoffLocation?.address || ride.drop || 'Drop location';
    
    document.getElementById('pickupAddress').textContent = pickupAddress;
    document.getElementById('dropAddress').textContent = dropAddress;
    
    // Update ride type - handle both 'type' and 'rideType'
    const rideType = ride.type || ride.rideType || 'economy';
    const rideTypeText = this.capitalizeFirst(rideType);
    document.getElementById('rideType').textContent = rideTypeText;
    
    // Update fare - show distance if available
    let fareText = `₹${Math.round(ride.fare || 0)}`;
    if (ride.distance) {
      fareText += ` (${ride.distance.toFixed(1)} km)`;
    }
    document.getElementById('fareAmount').textContent = fareText;
    
    // Show driver info if assigned
    if (ride.driver && ride.status !== 'searching') {
      console.log('👤 Displaying driver info:', ride.driver);
      this.displayDriverInfo(ride.driver);
    } else {
      console.log('⏳ No driver assigned yet');
    }
  }

  // Display driver information
  displayDriverInfo(driver) {
    const driverSection = document.getElementById('driverSection');
    if (driverSection) {
      driverSection.style.display = 'block';
    }
    
    // Driver name and avatar
    const driverName = driver.name || 'Driver';
    const driverNameEl = document.getElementById('driverName');
    if (driverNameEl) {
      driverNameEl.textContent = driverName;
    }
    
    const initials = driverName.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    const driverInitialsEl = document.getElementById('driverInitials');
    if (driverInitialsEl) {
      driverInitialsEl.textContent = initials;
    }
    
    // Driver rating - use actual rating from driver object
    const rating = driver.rating || 4.8;
    const driverRatingEl = document.getElementById('driverRating');
    if (driverRatingEl) {
      driverRatingEl.textContent = rating.toString();
    }
    
    // Vehicle info - use actual vehicle data from driver object
    const vehicleModel = driver.vehicle?.model || 'Vehicle';
    const vehicleNumber = driver.vehicle?.number || 'Unknown';
    const vehicleInfoEl = document.getElementById('vehicleInfo');
    if (vehicleInfoEl) {
      vehicleInfoEl.textContent = `${vehicleModel} • ${vehicleNumber}`;
    }
    
    console.log('✅ Driver info displayed:', {
      name: driverName,
      rating,
      vehicle: `${vehicleModel} • ${vehicleNumber}`
    });
    
    // Start ETA countdown
    this.startETACountdown();
  }

  // Update ride status
  updateRideStatus(status) {
    const statusElement = document.getElementById('rideStatus');
    const subStatusElement = document.getElementById('rideSubStatus');
    
    const statusMap = {
      'searching': {
        title: 'Finding Driver...',
        subtitle: 'Please wait while we find a driver'
      },
      'assigned': {
        title: 'Driver Assigned',
        subtitle: 'Driver is on the way'
      },
      'arriving': {
        title: 'Driver Arriving',
        subtitle: 'Driver will arrive soon'
      },
      'on_trip': {
        title: 'On Trip',
        subtitle: 'Enjoy your ride'
      },
      'completed': {
        title: 'Ride Completed',
        subtitle: 'Thank you for riding with us'
      },
      'cancelled': {
        title: 'Ride Cancelled',
        subtitle: 'Your ride has been cancelled'
      }
    };
    
    const statusInfo = statusMap[status] || statusMap.searching;
    statusElement.textContent = statusInfo.title;
    subStatusElement.textContent = statusInfo.subtitle;
    
    // Handle completed or cancelled
    if (status === 'completed' || status === 'cancelled') {
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 3000);
    }
  }

  // Update map with ride locations
  updateMapWithRide() {
    this.debugLog('🗺️ UPDATE MAP WITH RIDE START', 'info');
    console.log('🗺️ ========== UPDATE MAP WITH RIDE START ==========');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // CRITICAL CHECKS
    if (!this.map) {
      console.error('❌ CRITICAL: this.map is NULL or undefined!');
      this.debugLog('❌ Map not initialized!', 'error');
      alert('Map not initialized! Please refresh the page.');
      return;
    }
    this.debugLog('✅ Map object exists', 'success');
    console.log('✅ Map object exists:', this.map);
    console.log('✅ Map container ID:', this.map.getContainer()?.id);
    console.log('✅ Map zoom level:', this.map.getZoom());
    console.log('✅ Map center:', this.map.getCenter());
    
    if (!this.currentRide) {
      console.error('❌ CRITICAL: this.currentRide is NULL or undefined!');
      this.debugLog('❌ No ride data!', 'error');
      alert('No ride data! Please refresh the page.');
      return;
    }
    
    const ride = this.currentRide;
    this.debugLog('✅ Ride data loaded', 'success');
    console.log('✅ Current ride:', ride);
    
    // FORCE MAP REFRESH BEFORE ADDING MARKERS
    this.debugLog('🔄 Refreshing map size...', 'info');
    console.log('🔄 Force invalidating map size BEFORE markers...');
    this.map.invalidateSize(true);
    setTimeout(() => this.map.invalidateSize(true), 50);
    setTimeout(() => this.map.invalidateSize(true), 100);
    
    // Clear existing markers
    if (this.pickupMarker) {
      this.map.removeLayer(this.pickupMarker);
      this.pickupMarker = null;
    }
    if (this.dropMarker) {
      this.map.removeLayer(this.dropMarker);
      this.dropMarker = null;
    }
    if (this.driverMarker) {
      this.map.removeLayer(this.driverMarker);
      this.driverMarker = null;
    }
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    
    // Extract pickup coordinates (handle multiple formats)
    let pickupLat, pickupLng;
    
    console.log('🔍 DEBUG: ride.pickupLocation =', ride.pickupLocation);
    console.log('🔍 DEBUG: ride.pickupLocation.lat =', ride.pickupLocation?.lat);
    console.log('🔍 DEBUG: ride.pickupLocation.lng =', ride.pickupLocation?.lng);
    console.log('🔍 DEBUG: ride.pickupLocation.coordinates =', ride.pickupLocation?.coordinates);
    
    if (ride.pickupLocation?.lat && ride.pickupLocation?.lng) {
      pickupLat = parseFloat(ride.pickupLocation.lat);
      pickupLng = parseFloat(ride.pickupLocation.lng);
      console.log('✅ Using ride.pickupLocation.lat/lng');
    } else if (ride.pickupLocation?.coordinates && ride.pickupLocation.coordinates.length >= 2) {
      // coordinates format: [lng, lat]
      pickupLng = parseFloat(ride.pickupLocation.coordinates[0]);
      pickupLat = parseFloat(ride.pickupLocation.coordinates[1]);
      console.log('✅ Using ride.pickupLocation.coordinates');
    } else {
      // Fallback to default
      pickupLat = 12.9716;
      pickupLng = 77.5946;
      console.warn('⚠️ Using default pickup coordinates (Bangalore fallback)');
      console.warn('⚠️ ride.pickupLocation was:', ride.pickupLocation);
    }
    
    // Extract drop coordinates (handle multiple formats)
    let dropLat, dropLng;
    
    console.log('🔍 DEBUG: ride.dropoffLocation =', ride.dropoffLocation);
    console.log('🔍 DEBUG: ride.dropoffLocation.lat =', ride.dropoffLocation?.lat);
    console.log('🔍 DEBUG: ride.dropoffLocation.lng =', ride.dropoffLocation?.lng);
    console.log('🔍 DEBUG: ride.dropoffLocation.coordinates =', ride.dropoffLocation?.coordinates);
    
    if (ride.dropoffLocation?.lat && ride.dropoffLocation?.lng) {
      dropLat = parseFloat(ride.dropoffLocation.lat);
      dropLng = parseFloat(ride.dropoffLocation.lng);
      console.log('✅ Using ride.dropoffLocation.lat/lng');
    } else if (ride.dropoffLocation?.coordinates && ride.dropoffLocation.coordinates.length >= 2) {
      // coordinates format: [lng, lat]
      dropLng = parseFloat(ride.dropoffLocation.coordinates[0]);
      dropLat = parseFloat(ride.dropoffLocation.coordinates[1]);
      console.log('✅ Using ride.dropoffLocation.coordinates');
    } else {
      // Fallback to default
      dropLat = 12.9800;
      dropLng = 77.6000;
      console.warn('⚠️ Using default drop coordinates (Bangalore fallback)');
      console.warn('⚠️ ride.dropoffLocation was:', ride.dropoffLocation);
    }
    
    console.log('📍 FINAL Pickup coordinates:', { lat: pickupLat, lng: pickupLng });
    console.log('🎯 FINAL Drop coordinates:', { lat: dropLat, lng: dropLng });
    
    // Validate coordinates
    if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropLat) || isNaN(dropLng)) {
      console.error('❌ Invalid coordinates detected!');
      this.showToast('❌ Invalid ride coordinates');
      return;
    }
    
    // Store coordinates for API methods
    this.pickupCoords = { lat: pickupLat, lng: pickupLng };
    this.dropCoords = { lat: dropLat, lng: dropLng };
    
    // Add pickup marker (green with theme accent)
    console.log('🔨 Creating pickup marker...');
    try {
      const pickupIcon = L.divIcon({
        className: 'custom-marker pickup-marker',
        html: '<div class="pickup-icon-wrapper" style="background: #27ae60; width: 40px; height: 40px; border-radius: 50%; display: flex !important; align-items: center; justify-content: center; font-size: 22px; color: white; border: 4px solid white; box-shadow: 0 6px 16px rgba(39,174,96,0.6); z-index: 99999 !important; position: relative !important; transform: translate(-50%, -50%);">📍</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      console.log('✅ Pickup icon created');
      
      this.pickupMarker = L.marker([pickupLat, pickupLng], { 
        icon: pickupIcon,
        zIndexOffset: 10000,
        interactive: true,
        riseOnHover: true
      }).addTo(this.map);
      
      this.debugLog('✅ 📍 Pickup marker added', 'success');
      console.log('✅ Pickup marker added to map!');
      console.log('   Position:', this.pickupMarker.getLatLng());
      console.log('   Marker object:', this.pickupMarker);
      console.log('   Marker _icon element:', this.pickupMarker._icon);
      
      this.pickupMarker.bindPopup(`<b style="color: #2E4053;">📍 Pickup</b><br>${ride.pickupLocation?.address || 'Pickup Location'}`);
      
      // FORCE VISIBILITY CHECK
      setTimeout(() => {
        if (this.pickupMarker && this.pickupMarker._icon) {
          console.log('✅ VERIFICATION: Pickup marker icon exists in DOM');
          this.pickupMarker._icon.style.display = 'block !important';
          this.pickupMarker._icon.style.opacity = '1';
          this.pickupMarker._icon.style.visibility = 'visible';
        } else {
          console.error('❌ VERIFICATION FAILED: Pickup marker icon NOT in DOM!');
        }
      }, 200);
    } catch (error) {
      console.error('❌ ERROR adding pickup marker:', error);
      alert('ERROR: Could not create pickup marker - ' + error.message);
    }
    
    // Add drop marker (red with theme accent)
    console.log('🔨 Creating drop marker...');
    try {
      const dropIcon = L.divIcon({
        className: 'custom-marker drop-marker',
        html: '<div class="drop-icon-wrapper" style="background: #e74c3c; width: 40px; height: 40px; border-radius: 50%; display: flex !important; align-items: center; justify-content: center; font-size: 22px; color: white; border: 4px solid white; box-shadow: 0 6px 16px rgba(231,76,60,0.6); z-index: 99999 !important; position: relative !important; transform: translate(-50%, -50%);">🎯</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      console.log('✅ Drop icon created');
      
      this.dropMarker = L.marker([dropLat, dropLng], { 
        icon: dropIcon,
        zIndexOffset: 10000,
        interactive: true,
        riseOnHover: true
      }).addTo(this.map);
      
      this.debugLog('✅ 🎯 Drop marker added', 'success');
      console.log('✅ Drop marker added to map!');
      console.log('   Position:', this.dropMarker.getLatLng());
      console.log('   Marker object:', this.dropMarker);
      console.log('   Marker _icon element:', this.dropMarker._icon);
      
      this.dropMarker.bindPopup(`<b style="color: #2E4053;">🎯 Drop</b><br>${ride.dropoffLocation?.address || 'Drop Location'}`);
      
      // FORCE VISIBILITY CHECK
      setTimeout(() => {
        if (this.dropMarker && this.dropMarker._icon) {
          console.log('✅ VERIFICATION: Drop marker icon exists in DOM');
          this.dropMarker._icon.style.display = 'block !important';
          this.dropMarker._icon.style.opacity = '1';
          this.dropMarker._icon.style.visibility = 'visible';
        } else {
          console.error('❌ VERIFICATION FAILED: Drop marker icon NOT in DOM!');
        }
      }, 200);
    } catch (error) {
      console.error('❌ ERROR adding drop marker:', error);
      alert('ERROR: Could not create drop marker - ' + error.message);
    }
    
    // Add driver marker if driver location is available
    if (ride.driver && ride.driver.location) {
      const driverLat = ride.driver.location.lat || ride.driver.location.latitude;
      const driverLng = ride.driver.location.lng || ride.driver.location.longitude;
      
      if (driverLat && driverLng) {
        console.log('� Creating driver marker at:', driverLat, driverLng);
        
        // Store driver coordinates
        this.driverCoords = { lat: driverLat, lng: driverLng };
        
        try {
          const driverIcon = L.divIcon({
            className: 'driver-marker',
            html: '<div class="driver-icon-wrapper" style="background: #3498db; width: 44px; height: 44px; border-radius: 50%; display: flex !important; align-items: center; justify-content: center; font-size: 24px; color: white; border: 4px solid white; box-shadow: 0 6px 20px rgba(52,152,219,0.7); animation: driverPulse 2s ease-in-out infinite; z-index: 99999 !important; position: relative !important; transform: translate(-50%, -50%);">🚗</div><style>@keyframes driverPulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.15); box-shadow: 0 8px 24px rgba(52,152,219,0.9); } }</style>',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });
          
          this.driverMarker = L.marker([driverLat, driverLng], { 
            icon: driverIcon,
            zIndexOffset: 10000,
            interactive: true,
            riseOnHover: true
          }).addTo(this.map);
          
          console.log('✅ Driver marker added to map!');
          console.log('   Position:', this.driverMarker.getLatLng());
          console.log('   Marker object:', this.driverMarker);
          
          this.driverMarker.bindPopup(`<b style="color: #2E4053;">🚗 Driver: ${ride.driver.name || 'Rajesh'}</b><br>${ride.driver.vehicle?.model || 'Honda City'}`);
          
          // FORCE VISIBILITY CHECK
          setTimeout(() => {
            if (this.driverMarker && this.driverMarker._icon) {
              console.log('✅ VERIFICATION: Driver marker icon exists in DOM');
              this.driverMarker._icon.style.display = 'block !important';
              this.driverMarker._icon.style.opacity = '1';
              this.driverMarker._icon.style.visibility = 'visible';
            } else {
              console.error('❌ VERIFICATION FAILED: Driver marker icon NOT in DOM!');
            }
          }, 200);
        } catch (error) {
          console.error('❌ ERROR adding driver marker:', error);
        }
      }
    }
    
    console.log('📊 MARKER STATUS AFTER CREATION:');
    console.log('  Pickup marker exists?', !!this.pickupMarker);
    console.log('  Drop marker exists?', !!this.dropMarker);
    console.log('  Pickup at:', pickupLat, pickupLng);
    console.log('  Drop at:', dropLat, dropLng);
    
    // Draw route line using real road route if available
    const routeCoords = ride.routeCoordinates || this.rideDataFromUrl?.routeCoordinates;
    
    console.log('🛣️ Route coordinates check:');
    console.log('  From ride:', ride.routeCoordinates ? `${ride.routeCoordinates.length} points` : 'none');
    console.log('  From URL:', this.rideDataFromUrl?.routeCoordinates ? `${this.rideDataFromUrl.routeCoordinates.length} points` : 'none');
    console.log('  Final:', routeCoords ? `${routeCoords.length} points` : 'none');
    
    if (routeCoords && routeCoords.length > 1) {
      console.log('🔨 Drawing route with', routeCoords.length, 'coordinates...');
      try {
        // Use real road route coordinates (OSRM format is [lng, lat])
        const latLngs = routeCoords.map(coord => {
          // Handle both [lng, lat] and [lat, lng] formats
          if (Array.isArray(coord)) {
            return [coord[1], coord[0]]; // Convert [lng, lat] to [lat, lng]
          }
          return coord;
        });
        
        this.routeLine = L.polyline(latLngs, {
          color: '#2E4053',
          weight: 6,
          opacity: 0.75,
          smoothFactor: 1
        }).addTo(this.map);
        
        console.log('✅ Route drawn with', routeCoords.length, 'points');
        
        // Update info card with route data if available
        if (ride.distance && ride.duration) {
          document.getElementById('distanceValue').textContent = `${ride.distance.toFixed(1)} km`;
          document.getElementById('timeValue').textContent = `${Math.round(ride.duration)} min`;
          
          // Calculate traffic level from average speed
          const avgSpeed = (ride.distance / (ride.duration / 60));
          if (avgSpeed > 30) {
            this.trafficLevel = 'low';
          } else if (avgSpeed > 20) {
            this.trafficLevel = 'medium';
          } else {
            this.trafficLevel = 'heavy';
          }
          this.updateTrafficIndicator();
        }
      } catch (routeError) {
        console.error('❌ Error drawing route:', routeError);
        // Fallback to straight line
        this.routeLine = L.polyline(
          [[pickupLat, pickupLng], [dropLat, dropLng]],
          {
            color: '#3498db',
            weight: 4,
            opacity: 0.6,
            dashArray: '12, 8'
          }
        ).addTo(this.map);
        console.log('⚠️ Fallback: straight line route drawn');
      }
    } else {
      // Always draw SOMETHING - either fetch real route or draw straight line
      console.log('🔄 No route coordinates, fetching real route from OSRM...');
      this.fetchAndDrawRoute(pickupLat, pickupLng, dropLat, dropLng);
    }
    
    // Fit bounds to show all markers (including driver if present)
    const boundsPoints = [[pickupLat, pickupLng], [dropLat, dropLng]];
    
    if (ride.driver && ride.driver.location) {
      const driverLat = ride.driver.location.lat || ride.driver.location.latitude;
      const driverLng = ride.driver.location.lng || ride.driver.location.longitude;
      if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
        boundsPoints.push([driverLat, driverLng]);
        console.log('📍 Including driver in bounds:', driverLat, driverLng);
      }
    }
    
    // Include user's current location if available
    if (this.myLocation && this.myLocation.lat && this.myLocation.lng) {
      boundsPoints.push([this.myLocation.lat, this.myLocation.lng]);
      console.log('📍 Including user location in bounds:', this.myLocation);
    }
    
    console.log('📐 Fitting map bounds to', boundsPoints.length, 'points');
    
    try {
      const bounds = L.latLngBounds(boundsPoints);
      this.map.fitBounds(bounds, { 
        padding: [80, 80], 
        maxZoom: 15,
        animate: true,
        duration: 0.5
      });
      console.log('✅ Map bounds set successfully');
    } catch (boundsError) {
      console.error('❌ Error setting bounds:', boundsError);
      // Fallback: center between pickup and drop
      const centerLat = (pickupLat + dropLat) / 2;
      const centerLng = (pickupLng + dropLng) / 2;
      this.map.setView([centerLat, centerLng], 13, { animate: true });
      console.log('⚠️ Using fallback center:', centerLat, centerLng);
    }
    
    console.log('✅ Map fully updated with pickup, drop, and route');
    console.log('📊 MAP SUMMARY:');
    console.log('  • Pickup marker:', this.pickupMarker ? '✓' : '✗');
    console.log('  • Drop marker:', this.dropMarker ? '✓' : '✗');
    console.log('  • Driver marker:', this.driverMarker ? '✓' : '✗');
    console.log('  • Route line:', this.routeLine ? '✓' : '✗');
    console.log('  • My location:', this.myLocationMarker ? '✓' : '✗');
    
    // Force map to recalculate its size and refresh tiles - MULTIPLE TIMES
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        console.log('✅ Map size invalidated (first pass)');
      }
    }, 100);
    
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        console.log('✅ Map size invalidated (second pass)');
        
        // Final verification - check if markers are actually visible
        if (this.pickupMarker && this.dropMarker) {
          const pickupPos = this.pickupMarker.getLatLng();
          const dropPos = this.dropMarker.getLatLng();
          console.log('🔍 FINAL CHECK:');
          console.log('  📍 Pickup marker at:', pickupPos);
          console.log('  🎯 Drop marker at:', dropPos);
          console.log('  🗺️ Map center:', this.map.getCenter());
          console.log('  🔎 Map zoom:', this.map.getZoom());
          
          // Force one more bounds fit to ensure visibility
          this.refitMapBounds();
        }
      }
    }, 500);
    
    // Show success toast
    this.showToast('✅ Map loaded successfully!');
    
    console.log('🗺️ ========== UPDATE MAP WITH RIDE COMPLETE ==========');
    
    // FINAL DIAGNOSTIC - Check if markers are actually on the map
    setTimeout(() => {
      console.log('🔍 ========== FINAL DIAGNOSTIC CHECK (1000ms) ==========');
      console.log('⏰ Check time:', new Date().toISOString());
      console.log('Map object exists?', !!this.map);
      console.log('Pickup marker exists?', !!this.pickupMarker);
      console.log('Drop marker exists?', !!this.dropMarker);
      console.log('Route line exists?', !!this.routeLine);
      console.log('Driver marker exists?', !!this.driverMarker);
      console.log('User location marker exists?', !!this.myLocationMarker);
      
      let allMarkersVisible = true;
      let missingItems = [];
      
      if (this.pickupMarker) {
        const onMap = this.map.hasLayer(this.pickupMarker);
        const hasIcon = !!this.pickupMarker._icon;
        console.log('📍 Pickup marker on map?', onMap);
        console.log('📍 Pickup marker has DOM icon?', hasIcon);
        if (hasIcon) {
          console.log('📍 Pickup marker icon display:', this.pickupMarker._icon.style.display);
          console.log('📍 Pickup marker icon visibility:', this.pickupMarker._icon.style.visibility);
          console.log('📍 Pickup marker icon opacity:', this.pickupMarker._icon.style.opacity);
          // FORCE VISIBILITY
          this.pickupMarker._icon.style.display = 'block';
          this.pickupMarker._icon.style.visibility = 'visible';
          this.pickupMarker._icon.style.opacity = '1';
          this.pickupMarker._icon.style.zIndex = '99999';
        } else {
          allMarkersVisible = false;
          missingItems.push('Pickup marker icon');
        }
      } else {
        allMarkersVisible = false;
        missingItems.push('Pickup marker');
      }
      
      if (this.dropMarker) {
        const onMap = this.map.hasLayer(this.dropMarker);
        const hasIcon = !!this.dropMarker._icon;
        console.log('🎯 Drop marker on map?', onMap);
        console.log('🎯 Drop marker has DOM icon?', hasIcon);
        if (hasIcon) {
          console.log('🎯 Drop marker icon display:', this.dropMarker._icon.style.display);
          console.log('🎯 Drop marker icon visibility:', this.dropMarker._icon.style.visibility);
          console.log('🎯 Drop marker icon opacity:', this.dropMarker._icon.style.opacity);
          // FORCE VISIBILITY
          this.dropMarker._icon.style.display = 'block';
          this.dropMarker._icon.style.visibility = 'visible';
          this.dropMarker._icon.style.opacity = '1';
          this.dropMarker._icon.style.zIndex = '99999';
        } else {
          allMarkersVisible = false;
          missingItems.push('Drop marker icon');
        }
      } else {
        allMarkersVisible = false;
        missingItems.push('Drop marker');
      }
      
      if (this.driverMarker) {
        const onMap = this.map.hasLayer(this.driverMarker);
        const hasIcon = !!this.driverMarker._icon;
        console.log('🚗 Driver marker on map?', onMap);
        console.log('🚗 Driver marker has DOM icon?', hasIcon);
        if (hasIcon) {
          // FORCE VISIBILITY
          this.driverMarker._icon.style.display = 'block';
          this.driverMarker._icon.style.visibility = 'visible';
          this.driverMarker._icon.style.opacity = '1';
          this.driverMarker._icon.style.zIndex = '99999';
        } else {
          missingItems.push('Driver marker icon');
        }
      }
      
      if (this.routeLine) {
        const onMap = this.map.hasLayer(this.routeLine);
        console.log('🛣️ Route line on map?', onMap);
        if (!onMap) {
          missingItems.push('Route line');
        }
      } else {
        missingItems.push('Route line');
      }
      
      // Check DOM for marker elements
      const markerElements = document.querySelectorAll('.leaflet-marker-icon');
      console.log('📊 Total marker elements in DOM:', markerElements.length);
      markerElements.forEach((el, i) => {
        const isVisible = el.offsetParent !== null;
        console.log(`  Marker ${i}:`, el.className, 'visible:', isVisible, 'display:', el.style.display);
        // FORCE VISIBILITY FOR ALL
        if (!isVisible) {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.style.zIndex = '99999';
          console.log(`  ⚠️ Marker ${i} was hidden, forcing visible!`);
        }
      });
      
      const polylines = document.querySelectorAll('.leaflet-interactive');
      console.log('📊 Total polyline elements in DOM:', polylines.length);
      
      // Force one more map refresh
      this.map.invalidateSize(true);
      console.log('🔄 Final map invalidateSize called');
      
      // SHOW SUMMARY
      console.log('📊 FINAL SUMMARY:');
      console.log('  All markers visible:', allMarkersVisible);
      if (missingItems.length > 0) {
        console.error('❌ Missing items:', missingItems.join(', '));
      } else {
        console.log('✅ ALL ITEMS PRESENT!');
      }
      
      // If no markers visible, show alert
      if (!this.pickupMarker || !this.dropMarker) {
        console.error('❌ CRITICAL: MARKERS NOT CREATED!');
        alert('❌ ERROR: Map markers not created.\n\nPlease check browser console (F12) and report the error.');
      } else if (markerElements.length === 0) {
        console.error('❌ CRITICAL: NO MARKER ELEMENTS IN DOM!');
        alert('❌ ERROR: Markers created but not visible in DOM.\n\nPlease check browser console (F12) and report the error.');
      } else {
        console.log('✅ SUCCESS: Markers are present and have been forced visible!');
        this.debugLog('✅ ALL MARKERS VISIBLE!', 'success');
      }
      
      // Auto-hide debug console after 5 seconds
      setTimeout(() => {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
          debugConsole.style.transition = 'opacity 1s';
          debugConsole.style.opacity = '0';
          setTimeout(() => {
            debugConsole.style.display = 'none';
          }, 1000);
        }
      }, 5000);
      
      console.log('🔍 ========== END DIAGNOSTIC ==========');
    }, 1000);
  }

  // Helper method to refit map bounds to show all markers
  refitMapBounds() {
    const boundsPoints = [];
    
    // Add pickup marker if exists
    if (this.pickupMarker) {
      const pos = this.pickupMarker.getLatLng();
      boundsPoints.push([pos.lat, pos.lng]);
    }
    
    // Add drop marker if exists
    if (this.dropMarker) {
      const pos = this.dropMarker.getLatLng();
      boundsPoints.push([pos.lat, pos.lng]);
    }
    
    // Add driver marker if exists
    if (this.driverMarker) {
      const pos = this.driverMarker.getLatLng();
      boundsPoints.push([pos.lat, pos.lng]);
    }
    
    // Add user location if exists
    if (this.myLocationMarker) {
      const pos = this.myLocationMarker.getLatLng();
      boundsPoints.push([pos.lat, pos.lng]);
    }
    
    // Only fit bounds if we have at least 2 points
    if (boundsPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        this.map.fitBounds(bounds, { 
          padding: [80, 80], 
          maxZoom: 15,
          animate: true,
          duration: 0.5
        });
        console.log('✅ Map bounds refitted to', boundsPoints.length, 'markers');
      } catch (error) {
        console.error('❌ Error refitting bounds:', error);
      }
    }
  }

  // Fetch and draw real road route
  async fetchAndDrawRoute(startLat, startLng, endLat, endLng) {
    console.log(`🔄 Fetching route from OSRM: [${startLat}, ${startLng}] → [${endLat}, ${endLng}]`);
    
    try {
      // Try to use geocoding service if available
      if (this.geocodingService && this.geocodingService.getRoadRoute) {
        const route = await this.geocodingService.getRoadRoute(startLat, startLng, endLat, endLng);
        
        console.log('🔍 Geocoding service route response:', route);
        
        if (route && route.coordinates && route.coordinates.length > 0) {
          // OSRM format is [lng, lat], Leaflet needs [lat, lng]
          const latLngs = route.coordinates.map(coord => [coord[1], coord[0]]);
          
          // Remove old route if exists
          if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
          }
          
          // Draw real road route
          this.routeLine = L.polyline(latLngs, {
            color: '#2E4053',
            weight: 6,
            opacity: 0.75,
            smoothFactor: 1
          }).addTo(this.map);
          
          // Handle distance - may be number or string, may be in meters or km
          const distance = typeof route.distance === 'number' ? route.distance : parseFloat(route.distance) || 0;
          const distanceKm = distance > 100 ? (distance / 1000) : distance; // Convert meters to km if needed
          
          // Handle duration - may be number or string, may be in seconds or minutes
          const duration = typeof route.duration === 'number' ? route.duration : parseFloat(route.duration) || 0;
          const durationMin = duration > 100 ? (duration / 60) : duration; // Convert seconds to minutes if needed
          
          console.log(`✅ Real road route drawn: ${distanceKm.toFixed(1)} km, ${latLngs.length} points`);
          
          // Update info card with validated data
          document.getElementById('distanceValue').textContent = `${distanceKm.toFixed(1)} km`;
          document.getElementById('timeValue').textContent = `${Math.round(durationMin)} min`;
          
          return; // Success, exit
        } else {
          console.warn('⚠️ Geocoding service returned invalid route data:', route);
        }
      }
      
      // If geocoding service failed, try direct OSRM API call
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const latLngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        // Remove old route if exists
        if (this.routeLine) {
          this.map.removeLayer(this.routeLine);
        }
        
        // Draw real road route
        this.routeLine = L.polyline(latLngs, {
          color: '#2E4053',
          weight: 6,
          opacity: 0.75,
          smoothFactor: 1
        }).addTo(this.map);
        
        const distance = route.distance / 1000;
        const duration = route.duration / 60;
        
        console.log(`✅ OSRM route drawn: ${distance.toFixed(1)} km, ${latLngs.length} points`);
        
        // Update info card
        document.getElementById('distanceValue').textContent = `${distance.toFixed(1)} km`;
        document.getElementById('timeValue').textContent = `${Math.round(duration)} min`;
        
        return; // Success
      }
    } catch (error) {
      console.error('❌ Failed to fetch road route:', error);
    }
    
    // Fallback to straight line if everything failed
    console.warn('⚠️ Using fallback: drawing straight line route');
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }
    this.routeLine = L.polyline(
      [[startLat, startLng], [endLat, endLng]],
      {
        color: '#3498db',
        weight: 4,
        opacity: 0.6,
        dashArray: '12, 8'
      }
    ).addTo(this.map);
    console.log('✅ Fallback straight line route drawn');
  }

  // Start ETA countdown
  startETACountdown() {
    // Calculate initial ETA based on ride distance if available
    const rideDistance = this.currentRide?.distance || 2.3;
    let eta = Math.max(3, Math.ceil(rideDistance / 0.5)); // Assume 30km/h average speed
    let distance = parseFloat(rideDistance);
    
    const updateETA = () => {
      if (eta > 0) {
        eta -= 0.1;
        distance -= 0.05;
      }
      
      document.getElementById('etaValue').textContent = 
        `${Math.max(1, Math.ceil(eta))} min`;
      document.getElementById('distanceValue').textContent = 
        `${Math.max(0.1, distance).toFixed(1)} km`;
    };
    
    updateETA();
    this.etaInterval = setInterval(updateETA, 6000); // Update every 6 seconds
  }

  // Trigger SOS
  async triggerSOS() {
    try {
      const response = await this.api.request('/emergency/sos', {
        method: 'POST',
        body: JSON.stringify({
          rideId: this.rideId,
          location: this.currentRide?.pickupLocation || {}
        })
      });
      
      if (response.success) {
        this.showToast('🚨 Emergency alert sent!');
        // Visual indication
        document.body.style.animation = 'flash 0.5s 3';
      }
    } catch (error) {
      console.error('SOS error:', error);
      this.showToast('Failed to send emergency alert');
    }
  }

  // Generate share link
  generateShareLink() {
    const shareURL = `${window.location.origin}/track/${this.rideId}`;
    document.getElementById('shareLinkInput').value = shareURL;
  }

  // Share on WhatsApp
  shareOnWhatsApp() {
    const message = `Track my ride: ${window.location.origin}/track/${this.rideId}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // Share via SMS
  shareViaSMS() {
    const message = `Track my ride: ${window.location.origin}/track/${this.rideId}`;
    const url = `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = url;
  }

  // Cancel ride
  async cancelRide() {
    try {
      this.showLoading(true);
      
      const response = await this.api.cancelRide(this.rideId);
      
      if (response.success) {
        this.showToast('Ride cancelled successfully');
        setTimeout(() => {
          window.location.href = './dashboard.html';
        }, 2000);
      }
    } catch (error) {
      console.error('Cancel error:', error);
      this.showToast('Failed to cancel ride');
    } finally {
      this.showLoading(false);
    }
  }

  // Call driver
  callDriver() {
    // In a real app, this would initiate a phone call
    this.showToast('Calling driver...');
    // window.location.href = 'tel:+919876543210';
  }

  // Show loading overlay
  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  // Show toast notification
  showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Utility: Capitalize first letter
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Center map on user's current location
  centerOnMyLocation() {
    if (this.myLocation) {
      this.map.setView([this.myLocation.lat, this.myLocation.lng], 16, {
        animate: true,
        duration: 0.5
      });
      this.showToast('📍 Centered on your location');
      
      // Add visual feedback
      const btn = document.getElementById('myLocationBtn');
      btn?.classList.add('active');
      setTimeout(() => {
        btn?.classList.remove('active');
      }, 1000);
    } else {
      this.showToast('Unable to get your location');
      // Try to get location again
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.myLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.updateMyLocation(this.myLocation.lat, this.myLocation.lng);
          this.map.setView([this.myLocation.lat, this.myLocation.lng], 16, {
            animate: true,
            duration: 0.5
          });
        },
        (error) => {
          this.showToast('Location permission denied');
        }
      );
    }
  }

  // ===== PUBLIC API METHODS (as required by prompt) =====
  
  /**
   * Set pickup location and recalculate route
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  setPickup(lat, lng) {
    console.log(`📍 setPickup called: ${lat}, ${lng}`);
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('Invalid pickup coordinates');
      this.showToast('❌ Invalid pickup location');
      return;
    }
    
    this.pickupCoords = { lat, lng };
    
    // Update pickup marker
    if (this.pickupMarker) {
      this.pickupMarker.setLatLng([lat, lng]);
    } else {
      const pickupIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background: #27ae60; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; border: 3px solid white; box-shadow: 0 4px 12px rgba(39,174,96,0.4);">📍</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      this.pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(this.map);
    }
    
    // Auto-recalculate route if drop exists
    if (this.dropCoords) {
      this.recalculateRoute();
    }
  }
  
  /**
   * Set drop location and recalculate route
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  setDrop(lat, lng) {
    console.log(`🎯 setDrop called: ${lat}, ${lng}`);
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('Invalid drop coordinates');
      this.showToast('❌ Invalid drop location');
      return;
    }
    
    this.dropCoords = { lat, lng };
    
    // Update drop marker
    if (this.dropMarker) {
      this.dropMarker.setLatLng([lat, lng]);
    } else {
      const dropIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background: #e74c3c; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; border: 3px solid white; box-shadow: 0 4px 12px rgba(231,76,60,0.4);">🎯</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      this.dropMarker = L.marker([lat, lng], { icon: dropIcon }).addTo(this.map);
    }
    
    // Auto-recalculate route if pickup exists
    if (this.pickupCoords) {
      this.recalculateRoute();
    }
  }
  
  /**
   * Update driver location with smooth animation
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   */
  updateDriverLocation(lat, lng) {
    console.log(`🚗 updateDriverLocation called: ${lat}, ${lng}`);
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('Invalid driver coordinates');
      return;
    }
    
    const newCoords = { lat, lng };
    
    // Check if driver moved significantly (>50m)
    if (this.driverCoords) {
      const distance = this.calculateDistance(
        this.driverCoords.lat, this.driverCoords.lng,
        lat, lng
      );
      
      // If moved >50m, recalculate route
      if (distance > 0.05) {
        console.log(`🔄 Driver moved ${distance.toFixed(2)}km, recalculating route`);
        this.recalculateRoute();
      }
    }
    
    this.driverCoords = newCoords;
    this.lastDriverUpdate = Date.now();
    
    // Smooth marker animation
    if (!this.driverMarker) {
      const driverIcon = L.divIcon({
        className: 'driver-marker',
        html: '<div style="background: #3498db; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; border: 3px solid white; box-shadow: 0 4px 16px rgba(52,152,219,0.5); animation: driverPulse 2s ease-in-out infinite;">🚗</div><style>@keyframes driverPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); box-shadow: 0 6px 20px rgba(52,152,219,0.7); } }</style>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      this.driverMarker = L.marker([lat, lng], { icon: driverIcon }).addTo(this.map);
    } else {
      // Smooth pan animation
      this.driverMarker.setLatLng([lat, lng]);
    }
  }
  
  /**
   * Recalculate route using OSRM API with animation
   */
  async recalculateRoute() {
    console.log('🔄 recalculateRoute called');
    
    if (!this.pickupCoords || !this.dropCoords) {
      console.warn('Missing pickup or drop coordinates');
      return;
    }
    
    try {
      // Show calculating indicator
      document.getElementById('distanceValue').textContent = 'Calculating...';
      document.getElementById('timeValue').textContent = 'Calculating...';
      
      // Fetch route from OSRM
      const url = `https://router.project-osrm.org/route/v1/driving/${this.pickupCoords.lng},${this.pickupCoords.lat};${this.dropCoords.lng},${this.dropCoords.lat}?overview=full&geometries=geojson&steps=true`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        this.routeData = {
          distance: route.distance / 1000, // Convert to km
          duration: route.duration / 60, // Convert to minutes
          coordinates: route.geometry.coordinates
        };
        
        // Update info card
        document.getElementById('distanceValue').textContent = `${this.routeData.distance.toFixed(1)} km`;
        document.getElementById('timeValue').textContent = `${Math.round(this.routeData.duration)} min`;
        
        // Calculate traffic level based on time/distance ratio
        const avgSpeed = (this.routeData.distance / (this.routeData.duration / 60));
        if (avgSpeed > 30) {
          this.trafficLevel = 'low';
        } else if (avgSpeed > 20) {
          this.trafficLevel = 'medium';
        } else {
          this.trafficLevel = 'heavy';
        }
        
        this.updateTrafficIndicator();
        
        // Draw animated route
        this.drawAnimatedRoute(this.routeData.coordinates);
        
        // Fit bounds
        const bounds = L.latLngBounds([
          [this.pickupCoords.lat, this.pickupCoords.lng],
          [this.dropCoords.lat, this.dropCoords.lng]
        ]);
        
        if (this.driverCoords) {
          bounds.extend([this.driverCoords.lat, this.driverCoords.lng]);
        }
        
        this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        
        console.log('✅ Route recalculated:', this.routeData);
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      console.error('❌ Route calculation failed:', error);
      this.showToast('❌ Failed to calculate route');
      
      // Fallback to straight line
      if (this.routeLine) {
        this.map.removeLayer(this.routeLine);
      }
      this.routeLine = L.polyline(
        [[this.pickupCoords.lat, this.pickupCoords.lng], [this.dropCoords.lat, this.dropCoords.lng]],
        { color: '#3498db', weight: 4, opacity: 0.6, dashArray: '12, 8' }
      ).addTo(this.map);
    }
  }
  
  /**
   * Draw route with smooth animation
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   */
  drawAnimatedRoute(coordinates) {
    // Remove old route
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }
    
    // Convert [lng, lat] to [lat, lng] for Leaflet
    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
    
    // Create empty polyline
    this.routeLine = L.polyline([], {
      color: '#2E4053',
      weight: 6,
      opacity: 0.8,
      smoothFactor: 1,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.map);
    
    // Animate drawing
    let i = 0;
    const animateSegment = () => {
      if (i < latLngs.length) {
        const segment = latLngs.slice(0, i + 1);
        this.routeLine.setLatLngs(segment);
        i += Math.ceil(latLngs.length / 50); // Draw in ~50 steps
        this.animationFrame = requestAnimationFrame(animateSegment);
      } else {
        console.log('✅ Route animation complete');
      }
    };
    
    animateSegment();
  }
  
  /**
   * Update traffic indicator in info card
   */
  updateTrafficIndicator() {
    const indicator = document.getElementById('trafficIndicator');
    const text = document.getElementById('trafficText');
    
    const trafficMap = {
      low: { color: '#00b894', text: 'Low Traffic' },
      medium: { color: '#fdcb6e', text: 'Medium Traffic' },
      heavy: { color: '#d63031', text: 'Heavy Traffic' }
    };
    
    const traffic = trafficMap[this.trafficLevel] || trafficMap.low;
    
    if (indicator) {
      indicator.style.color = traffic.color;
    }
    if (text) {
      text.textContent = traffic.text;
    }
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      const progress = this.trafficLevel === 'low' ? 30 : this.trafficLevel === 'medium' ? 60 : 90;
      progressFill.style.width = `${progress}%`;
      progressFill.style.background = traffic.color;
    }
  }
  
  /**
   * Calculate distance between two coordinates (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // ===== END PUBLIC API METHODS =====

  // Cleanup on page unload
  cleanup() {
    if (this.socket) {
      this.socket.emit('unsubscribe_ride', { rideId: this.rideId });
      this.socket.disconnect();
    }
    if (this.etaInterval) {
      clearInterval(this.etaInterval);
    }
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const tracker = new LiveRideTracker();
  
  // Make tracker globally accessible for testing and API access
  window.liveRideTracker = tracker;
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    tracker.cleanup();
  });
  
  console.log('✅ LiveRideTracker initialized');
  console.log('💡 Access via: window.liveRideTracker');
  console.log('📚 API Methods: setPickup(lat,lng), setDrop(lat,lng), updateDriverLocation(lat,lng), recalculateRoute()');
});

// Add flash animation for SOS
const style = document.createElement('style');
style.textContent = `
  @keyframes flash {
    0%, 100% { background-color: white; }
    50% { background-color: #ff6b6b; }
  }
`;
document.head.appendChild(style);
