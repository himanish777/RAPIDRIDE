// Driver Dashboard JavaScript
import { API_BASE_URL, driverAPI } from './api.js';
import { driverSocketManager } from './socket.js';

// State Management
const state = {
  isOnline: false,
  currentRide: null,
  driverInfo: null,
  map: null,
  driverMarker: null,
  riderMarker: null,
  routeLine: null,
  requestTimer: null,
  onlineStartTime: null,
  rideRequestTimerInterval: null,
  autoRefreshInterval: null
};

// Make global functions available
window.showDriverNotification = showDriverNotification;
window.closeRideRequestModal = closeRideRequestModal;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  loadDriverProfile();
  setupEventListeners();
  loadTodayStats();
  loadWeeklyStats();
  loadPerformanceMetrics();
  checkSetupStatus();
  
  // Check authentication
  const token = localStorage.getItem('token');
  console.log('🔑 Driver Dashboard - Token check:', token ? 'Token exists' : 'No token found');
  console.log('🔑 Token value:', token);
  
  if (!token) {
    console.error('❌ No token found - redirecting to login');
    alert('No authentication token found. Please login as a driver.');
    window.location.href = '../../login.html';
    return;
  }

  // Request notification permission
  requestNotificationPermission();
  
  // Initialize socket connection after profile is loaded
  setTimeout(initializeSocketConnection, 1000);
  
  // Start auto-refresh for current ride status
  startDashboardAutoRefresh();
});

// Initialize Map
function initializeMap() {
  try {
    // Default to Bangalore coordinates
    const defaultLat = 12.9716;
    const defaultLng = 77.5946;
    
    state.map = L.map('mapContainer').setView([defaultLat, defaultLng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);
    
    // Add driver marker
    const driverIcon = L.divIcon({
      html: '🚗',
      iconSize: [30, 30],
      className: 'driver-marker'
    });
    
    state.driverMarker = L.marker([defaultLat, defaultLng], { icon: driverIcon })
      .addTo(state.map)
      .bindPopup('You are here');
    
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          state.driverMarker.setLatLng([lat, lng]);
          state.map.setView([lat, lng], 14);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  } catch (error) {
    console.error('Map initialization error:', error);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Online/Offline Toggle
  const onlineToggle = document.getElementById('onlineToggle');
  onlineToggle?.addEventListener('change', handleOnlineToggle);
  
  // Profile Menu
  const profileBtn = document.getElementById('profileBtn');
  profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Notifications
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationPanel = document.getElementById('notificationPanel');
  const closeNotificationBtn = document.getElementById('closeNotificationBtn');
  
  notificationBtn?.addEventListener('click', () => {
    notificationPanel?.classList.toggle('active');
  });
  
  closeNotificationBtn?.addEventListener('click', () => {
    notificationPanel?.classList.remove('active');
  });
  
  // Ride Request Actions
  document.getElementById('acceptRideBtn')?.addEventListener('click', acceptRideRequest);
  document.getElementById('declineRideBtn')?.addEventListener('click', declineRideRequest);
  
  // Current Ride Actions
  document.getElementById('viewLiveRideBtn')?.addEventListener('click', viewLiveRide);
  document.getElementById('callRiderBtn')?.addEventListener('click', callRider);
  document.getElementById('cancelRideBtn')?.addEventListener('click', cancelRide);
  
  // Quick Actions
  document.getElementById('viewEarningsBtn')?.addEventListener('click', showEarningsModal);
  document.getElementById('viewHistoryBtn')?.addEventListener('click', showRideHistory);
  document.getElementById('supportBtn')?.addEventListener('click', showSupportModal);
  
  // Settings
  document.getElementById('settingsBtn')?.addEventListener('click', showSettingsModal);
  document.getElementById('closeSettingsModalBtn')?.addEventListener('click', closeModal);
  
  // SOS
  document.getElementById('sosButton')?.addEventListener('click', showSosModal);
  document.getElementById('confirmSosBtn')?.addEventListener('click', triggerSOS);
  document.getElementById('cancelSosBtn')?.addEventListener('click', closeModal);
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', showLogoutModal);
  document.getElementById('confirmLogoutBtn')?.addEventListener('click', logout);
  document.getElementById('cancelLogoutBtn')?.addEventListener('click', closeModal);
  
  // Vehicle Setup
  document.getElementById('completeSetupBtn')?.addEventListener('click', showVehicleSetupModal);
  document.getElementById('closeVehicleSetupBtn')?.addEventListener('click', closeModal);
  document.getElementById('submitVehicleSetupBtn')?.addEventListener('click', submitVehicleSetup);
  
  // Modal Close Buttons
  document.getElementById('closeEarningsModalBtn')?.addEventListener('click', closeModal);
  document.getElementById('closeSupportModalBtn')?.addEventListener('click', closeModal);
  
  // Open Maps
  document.getElementById('openMapsBtn')?.addEventListener('click', openInMaps);
  
  // Click outside to close modals
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  });
}

// Load Driver Profile
async function loadDriverProfile() {
  try {
    const data = await driverAPI.getProfile();
    state.driverInfo = data.driver;
    
    // Update UI
    document.getElementById('profileBtn').querySelector('.profile-name').textContent = 
      data.driver.name || 'Driver';
    document.getElementById('profileBtn').querySelector('.profile-avatar').textContent = 
      (data.driver.name || 'D').charAt(0).toUpperCase();
    document.getElementById('driverRating').textContent = 
      data.driver.stats?.rating?.toFixed(1) || '5.0';
    
    // Restore online status from database
    const isOnline = data.driver.isOnline || false;
    const onlineToggle = document.getElementById('onlineToggle');
    if (onlineToggle) {
      onlineToggle.checked = isOnline;
      state.isOnline = isOnline;
      
      // Update UI elements to match status
      const statusText = document.getElementById('statusText');
      const statusIndicator = document.getElementById('statusIndicator');
      const statusMessage = document.getElementById('statusMessage');
      
      if (isOnline) {
        statusText.textContent = 'Online';
        statusText.style.color = 'var(--status-success)';
        statusIndicator?.classList.add('online');
        statusMessage.textContent = "You're Online";
        document.querySelector('.availability-tip').textContent = 'You will receive ride requests';
        
        // Note: Socket subscription will happen in initializeSocketConnection()
        console.log('📱 Driver is online - will subscribe to ride requests when socket connects');
      } else {
        statusText.textContent = 'Offline';
        statusText.style.color = 'var(--text-muted)';
        statusIndicator?.classList.remove('online');
        statusMessage.textContent = "You're Offline";
        document.querySelector('.availability-tip').textContent = 'Turn on to start receiving ride requests';
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showNotification('Failed to load profile', 'error');
  }
}

// Handle Online Toggle
async function handleOnlineToggle(e) {
  // Check if setup is complete
  const setupComplete = localStorage.getItem('vehicleSetupComplete');
  if (!setupComplete && e.target.checked) {
    e.target.checked = false;
    showVehicleSetupModal();
    showNotification('Please complete your vehicle setup first', 'warning');
    return;
  }

  const isOnline = e.target.checked;
  
  try {
    await driverAPI.setOnlineStatus(isOnline);
    
    state.isOnline = isOnline;
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusMessage = document.getElementById('statusMessage');
    
    if (state.isOnline) {
      statusText.textContent = 'Online';
      statusText.style.color = 'var(--status-success)';
      statusIndicator?.classList.add('online');
      statusMessage.textContent = "You're Online";
      document.querySelector('.availability-tip').textContent = 
        'You will receive ride requests';
      
      state.onlineStartTime = Date.now();
      
      // Start listening for ride requests
      startListeningForRequests();
      
      // Subscribe to ride requests via socket
      if (driverSocketManager.isConnected()) {
        driverSocketManager.subscribeToRideRequests();
        console.log('✅ Subscribed to ride requests');
      }
      
      showNotification('You are now online and ready to receive ride requests', 'success');
    } else {
      statusText.textContent = 'Offline';
      statusText.style.color = 'var(--text-muted)';
      statusIndicator?.classList.remove('online');
      statusMessage.textContent = "You're Offline";
      document.querySelector('.availability-tip').textContent = 
        'Turn on to start receiving ride requests';
      
      // Update online hours
      if (state.onlineStartTime) {
        const hours = ((Date.now() - state.onlineStartTime) / (1000 * 60 * 60)).toFixed(1);
        document.getElementById('onlineHours').textContent = hours;
      }
      
      stopListeningForRequests();
      
      // Unsubscribe from ride requests via socket
      if (driverSocketManager.isConnected()) {
        driverSocketManager.unsubscribeFromRideRequests();
        console.log('❌ Unsubscribed from ride requests');
      }
      
      showNotification('You are now offline', 'info');
    }
  } catch (error) {
    console.error('Error updating online status:', error);
    e.target.checked = !isOnline; // Revert toggle
    showNotification('Failed to update status', 'error');
  }
}

// Start Listening for Ride Requests (Simulated)
function startListeningForRequests() {
  // Simulate receiving a ride request after random time
  setTimeout(() => {
    if (state.isOnline && !state.currentRide) {
      showRideRequest({
        id: 'RIDE' + Math.random().toString(36).substr(2, 9),
        pickup: 'MG Road, Bangalore',
        drop: 'Koramangala, Bangalore',
        distance: '8.5 km',
        fare: '₹250',
        riderName: 'John Doe',
        riderRating: '4.8'
      });
    }
  }, Math.random() * 20000 + 10000); // Random between 10-30 seconds
}

function stopListeningForRequests() {
  if (state.requestTimer) {
    clearInterval(state.requestTimer);
    state.requestTimer = null;
  }
}

// Show Ride Request
function showRideRequest(request) {
  const requestCard = document.getElementById('requestCard');
  
  document.getElementById('requestPickup').textContent = request.pickup;
  document.getElementById('requestDrop').textContent = request.drop;
  document.getElementById('requestDistance').textContent = request.distance;
  document.getElementById('requestFare').textContent = request.fare;
  document.getElementById('requestRiderRating').textContent = request.riderRating;
  
  requestCard.style.display = 'block';
  
  // Start countdown timer
  let timeLeft = 15;
  const timerElement = document.getElementById('requestTimer');
  
  state.requestTimer = setInterval(() => {
    timeLeft--;
    timerElement.textContent = timeLeft + 's';
    
    if (timeLeft <= 0) {
      declineRideRequest();
    }
  }, 1000);
  
  // Play notification sound (optional)
  playNotificationSound();
}

// Accept Ride Request
async function acceptRideRequest() {
  if (state.requestTimer) {
    clearInterval(state.requestTimer);
  }
  
  try {
    // Get ride ID from state.currentRide (set when showing request)
    if (!state.currentRide || !state.currentRide.id) {
      throw new Error('No ride request available');
    }
    
    const response = await driverAPI.acceptRide(state.currentRide.id);
    state.currentRide = response.ride;
    
    document.getElementById('requestCard').style.display = 'none';
    
    // Show current ride card with real data
    const currentRideCard = document.getElementById('currentRideCard');
    const statusBar = document.getElementById('statusBar');
    
    document.getElementById('riderName').textContent = response.ride.rider?.name || 'Rider';
    document.getElementById('riderRating').textContent = `⭐ ${response.ride.rider?.rating?.toFixed(1) || '5.0'}`;
    document.getElementById('pickupAddress').textContent = response.ride.pickup?.address || 'Pickup Location';
    document.getElementById('dropAddress').textContent = response.ride.drop?.address || 'Drop Location';
    document.getElementById('rideDistance').textContent = response.ride.estimatedDistance || '0 km';
    document.getElementById('rideFare').textContent = `₹${response.ride.estimatedFare || '0'}`;
    document.getElementById('rideType').textContent = response.ride.rideType || 'Economy';
    
    currentRideCard.style.display = 'block';
    statusBar.style.display = 'flex';
    
    // Show navigation card
    document.getElementById('navigationCard').style.display = 'block';
    document.getElementById('navInstruction').querySelector('.nav-text').textContent = 
      'Head towards pickup location';
    document.getElementById('navDistance').textContent = response.ride.estimatedDistance || '0 km';
    document.getElementById('navEta').textContent = response.ride.estimatedTime || '0 min';
    
    // Add rider marker to map if coordinates available
    if (response.ride.pickup?.coordinates) {
      addRiderMarker(response.ride.pickup.coordinates[1], response.ride.pickup.coordinates[0]);
    }
    
    updateStatusBar(1);
    showNotification('Ride accepted! Navigate to pickup location', 'success');
  } catch (error) {
    console.error('Error accepting ride:', error);
    showNotification('Failed to accept ride', 'error');
    document.getElementById('requestCard').style.display = 'none';
  }
}

// Decline Ride Request
function declineRideRequest() {
  if (state.requestTimer) {
    clearInterval(state.requestTimer);
  }
  
  document.getElementById('requestCard').style.display = 'none';
  showNotification('Ride request declined', 'info');
  
  // Continue listening for new requests
  if (state.isOnline) {
    startListeningForRequests();
  }
}

// Start Ride
async function startRide() {
  try {
    if (!state.currentRide || !state.currentRide._id) {
      throw new Error('No active ride');
    }
    
    const response = await driverAPI.startRide(state.currentRide._id);
    state.currentRide = response.ride;
    
    document.getElementById('startRideBtn').style.display = 'none';
    document.getElementById('completeRideBtn').style.display = 'block';
    
    updateStatusBar(2);
    
    document.getElementById('navInstruction').querySelector('.nav-text').textContent = 
      'Head towards drop location';
    document.getElementById('navDistance').textContent = response.ride.estimatedDistance || '0 km';
    document.getElementById('navEta').textContent = response.ride.estimatedTime || '0 min';
    
    showNotification('Ride started! Navigate to destination', 'success');
  } catch (error) {
    console.error('Error starting ride:', error);
    showNotification('Failed to start ride', 'error');
  }
}

// Complete Ride
async function completeRide() {
  try {
    if (!state.currentRide || !state.currentRide._id) {
      throw new Error('No active ride');
    }
    
    const response = await driverAPI.completeRide(state.currentRide._id);
    
    const currentRideCard = document.getElementById('currentRideCard');
    const statusBar = document.getElementById('statusBar');
    const navigationCard = document.getElementById('navigationCard');
    
    currentRideCard.style.display = 'none';
    statusBar.style.display = 'none';
    navigationCard.style.display = 'none';
    
    updateStatusBar(4);
    
    // Reload stats from backend
    await loadTodayStats();
    
    showNotification(`Ride completed! ₹${response.ride.finalFare || '0'} earned`, 'success');
    
    // Clear rider marker
    if (state.riderMarker) {
      state.map.removeLayer(state.riderMarker);
      state.riderMarker = null;
    }
    
    // Clear current ride
    state.currentRide = null;
    
    // Continue listening for new requests
    if (state.isOnline) {
      startListeningForRequests();
    }
  } catch (error) {
    console.error('Error completing ride:', error);
    showNotification('Failed to complete ride', 'error');
  }
}

// View Live Ride (Navigate to live-ride page)
function viewLiveRide() {
  if (!state.currentRide || !state.currentRide._id) {
    showNotification('No active ride', 'error');
    return;
  }
  
  // Store current ride data in localStorage for live-ride page
  localStorage.setItem('currentDriverRide', JSON.stringify(state.currentRide));
  
  // Navigate to live-ride page with ride ID
  window.location.href = `live-ride.html?rideId=${state.currentRide._id}`;
}

// Cancel Ride
async function cancelRide() {
  const reason = prompt('Please provide a reason for cancellation:');
  if (!reason) return;
  
  try {
    if (!state.currentRide || !state.currentRide._id) {
      throw new Error('No active ride');
    }
    
    await driverAPI.cancelRide(state.currentRide._id, reason);
    
    document.getElementById('currentRideCard').style.display = 'none';
    document.getElementById('statusBar').style.display = 'none';
    document.getElementById('navigationCard').style.display = 'none';
    
    if (state.riderMarker) {
      state.map.removeLayer(state.riderMarker);
      state.riderMarker = null;
    }
    
    // Clear current ride
    state.currentRide = null;
    
    showNotification('Ride cancelled', 'warning');
    
    if (state.isOnline) {
      startListeningForRequests();
    }
  } catch (error) {
    console.error('Error cancelling ride:', error);
    showNotification('Failed to cancel ride', 'error');
  }
}

// Call Rider
function callRider() {
  showNotification('Calling rider...', 'info');
  // In production, this would initiate a phone call
}

// Add Rider Marker
function addRiderMarker(lat, lng) {
  const riderIcon = L.divIcon({
    html: '📍',
    iconSize: [30, 30],
    className: 'rider-marker'
  });
  
  state.riderMarker = L.marker([lat, lng], { icon: riderIcon })
    .addTo(state.map)
    .bindPopup('Pickup Location');
  
  // Draw route line
  const driverLatLng = state.driverMarker.getLatLng();
  state.routeLine = L.polyline([
    [driverLatLng.lat, driverLatLng.lng],
    [lat, lng]
  ], {
    color: '#FB923C',
    weight: 4,
    opacity: 0.7
  }).addTo(state.map);
  
  // Fit bounds to show both markers
  const bounds = L.latLngBounds([driverLatLng, [lat, lng]]);
  state.map.fitBounds(bounds, { padding: [50, 50] });
}

// Update Status Bar
function updateStatusBar(step) {
  const steps = document.querySelectorAll('.status-step');
  steps.forEach((el, index) => {
    if (index <= step) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// Load Today's Stats
async function loadTodayStats() {
  try {
    const data = await driverAPI.getTodayStats();
    document.getElementById('todayEarnings').textContent = data.earnings || '0';
    document.getElementById('todayRides').textContent = data.ridesCompleted || '0';
    document.getElementById('onlineHours').textContent = data.onlineHours?.toFixed(1) || '0';
  } catch (error) {
    console.error('Error loading today stats:', error);
    // Keep default values on error
  }
}

// Load Weekly Stats
async function loadWeeklyStats() {
  try {
    const data = await driverAPI.getWeeklyStats();
    document.getElementById('weeklyEarnings').textContent = `₹${data.earnings?.toLocaleString() || '0'}`;
    document.getElementById('weeklyRides').textContent = data.ridesCompleted || '0';
    document.getElementById('weeklyHours').textContent = `${data.onlineHours?.toFixed(0) || '0'}h`;
  } catch (error) {
    console.error('Error loading weekly stats:', error);
    // Keep default values on error
  }
}

// Load Performance Metrics
async function loadPerformanceMetrics() {
  try {
    const data = await driverAPI.getPerformance();
    const acceptance = data.acceptanceRate || 0;
    const completion = data.completionRate || 0;
    const rating = data.rating || 0;
    
    document.getElementById('acceptanceRate').textContent = acceptance.toFixed(0) + '%';
    document.getElementById('acceptanceProgress').style.width = acceptance + '%';
    
    document.getElementById('completionRate').textContent = completion.toFixed(0) + '%';
    document.getElementById('completionProgress').style.width = completion + '%';
    
    document.getElementById('ratingValue').textContent = rating.toFixed(1) + '/5';
    document.getElementById('ratingProgress').style.width = (rating / 5 * 100) + '%';
  } catch (error) {
    console.error('Error loading performance metrics:', error);
    // Keep default values on error
  }
}

// Show Earnings Modal
function showEarningsModal() {
  document.getElementById('totalFare').textContent = '1500';
  document.getElementById('platformFee').textContent = '225';
  document.getElementById('tips').textContent = '50';
  document.getElementById('netEarnings').textContent = '1325';
  
  document.getElementById('earningsModal').classList.add('active');
}

// Show Ride History
function showRideHistory() {
  showNotification('Ride history feature coming soon', 'info');
}

// Show Support Modal
function showSupportModal() {
  document.getElementById('supportModal').classList.add('active');
}

// Show Settings Modal
function showSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
  
  // Map style buttons
  document.querySelectorAll('[data-map-style]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const style = e.target.dataset.mapStyle;
      changeMapStyle(style);
    });
  });
  
  // Theme buttons
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.target.dataset.theme;
      changeTheme(theme);
    });
  });
}

// Show SOS Modal
function showSosModal() {
  document.getElementById('sosModal').classList.add('active');
}

// Trigger SOS
function triggerSOS() {
  showNotification('Emergency SOS triggered! Authorities notified', 'danger');
  closeModal();
  // In production, this would send emergency alerts
}

// Show Logout Modal
function showLogoutModal() {
  document.getElementById('logoutModal').classList.add('active');
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  window.location.href = '../../login.html';
}

// Close Modal
function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  });
}

// Open in Maps
function openInMaps() {
  const pickup = document.getElementById('pickupAddress').textContent;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup)}`;
  window.open(url, '_blank');
}

// Change Map Style
function changeMapStyle(style) {
  // Remove existing tile layer
  state.map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) {
      state.map.removeLayer(layer);
    }
  });
  
  // Add new tile layer based on style
  let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  switch(style) {
    case 'dark':
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      break;
    case 'terrain':
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      break;
    case 'satellite':
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      break;
  }
  
  L.tileLayer(tileUrl, {
    attribution: '© Map contributors'
  }).addTo(state.map);
  
  showNotification(`Map style changed to ${style}`, 'success');
}

// Change Theme
function changeTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  showNotification(`Theme changed to ${theme}`, 'success');
}

// Show Notification
function showNotification(message, type = 'info') {
  const colors = {
    success: '#16A34A',
    info: '#FB923C',
    warning: '#F59E0B',
    danger: '#DC2626'
  };
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 30px;
    background: ${colors[type]};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 10000;
    font-weight: 600;
    animation: slideInRight 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Play Notification Sound
function playNotificationSound() {
  // Create a simple beep sound
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Check Setup Status
async function checkSetupStatus() {
  const setupCard = document.getElementById('setupCard');
  
  try {
    // Check backend for vehicle setup status
    const vehicleInfo = await driverAPI.getVehicleInfo();
    
    if (vehicleInfo.vehicle && vehicleInfo.vehicle.number) {
      // Setup is complete
      localStorage.setItem('vehicleSetupComplete', 'true');
      localStorage.setItem('vehicleData', JSON.stringify(vehicleInfo.vehicle));
      setupCard.style.display = 'none';
    } else {
      // Setup incomplete
      localStorage.removeItem('vehicleSetupComplete');
      setupCard.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking setup status:', error);
    // Fall back to localStorage check
    const setupComplete = localStorage.getItem('vehicleSetupComplete');
    setupCard.style.display = setupComplete ? 'none' : 'block';
  }
}

// Show Vehicle Setup Modal
async function showVehicleSetupModal() {
  const modal = document.getElementById('vehicleSetupModal');
  modal.style.display = 'flex';
  
  try {
    // Load existing data from backend
    const vehicleInfo = await driverAPI.getVehicleInfo();
    const vehicleData = vehicleInfo.vehicle || {};
    
    if (Object.keys(vehicleData).length > 0) {
      document.getElementById('vehicleType').value = vehicleData.type || '';
      document.getElementById('vehicleMake').value = vehicleData.make || '';
      document.getElementById('vehicleModel').value = vehicleData.model || '';
      document.getElementById('vehicleNumber').value = vehicleData.number || '';
      document.getElementById('vehicleColor').value = vehicleData.color || '';
      document.getElementById('vehicleYear').value = vehicleData.year || '';
      document.getElementById('licenseNumber').value = vehicleData.license?.number || '';
      document.getElementById('insuranceNumber').value = vehicleData.insurance?.policyNumber || '';
    }
  } catch (error) {
    console.error('Error loading vehicle data:', error);
    // Try loading from localStorage as fallback
    const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
    if (Object.keys(vehicleData).length > 0) {
      document.getElementById('vehicleType').value = vehicleData.type || '';
      document.getElementById('vehicleMake').value = vehicleData.make || '';
      document.getElementById('vehicleModel').value = vehicleData.model || '';
      document.getElementById('vehicleNumber').value = vehicleData.number || '';
      document.getElementById('vehicleColor').value = vehicleData.color || '';
      document.getElementById('vehicleYear').value = vehicleData.year || '';
      document.getElementById('licenseNumber').value = vehicleData.license || '';
      document.getElementById('insuranceNumber').value = vehicleData.insurance || '';
    }
  }
}

// Submit Vehicle Setup
async function submitVehicleSetup() {
  // Get form values
  const vehicleData = {
    type: document.getElementById('vehicleType').value,
    make: document.getElementById('vehicleMake').value,
    model: document.getElementById('vehicleModel').value,
    number: document.getElementById('vehicleNumber').value.toUpperCase(),
    color: document.getElementById('vehicleColor').value,
    year: document.getElementById('vehicleYear').value,
    license: document.getElementById('licenseNumber').value.toUpperCase(),
    insurance: document.getElementById('insuranceNumber').value
  };
  
  // Validate all fields
  if (!vehicleData.type || !vehicleData.make || !vehicleData.model || 
      !vehicleData.number || !vehicleData.color || !vehicleData.year || 
      !vehicleData.license || !vehicleData.insurance) {
    showNotification('Please fill in all required fields', 'warning');
    return;
  }
  
  // Validate vehicle number format (basic check)
  if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(vehicleData.number)) {
    showNotification('Invalid vehicle number format. Use format: KA01AB1234', 'warning');
    return;
  }
  
  // Validate year
  const currentYear = new Date().getFullYear();
  if (vehicleData.year < 1990 || vehicleData.year > currentYear) {
    showNotification('Please enter a valid year', 'warning');
    return;
  }
  
  try {
    const response = await driverAPI.submitVehicleSetup(vehicleData);
    
    // Save to localStorage
    localStorage.setItem('vehicleSetupComplete', 'true');
    localStorage.setItem('vehicleData', JSON.stringify(vehicleData));
    
    // Update UI
    checkSetupStatus();
    closeModal();
    
    showNotification('Vehicle setup completed successfully!', 'success');
    
    // Update driver info display
    state.driverInfo = { ...state.driverInfo, vehicle: vehicleData };
  } catch (error) {
    console.error('Vehicle setup error:', error);
    showNotification(error.message || 'Failed to save vehicle information', 'error');
  }
}

// ===== SOCKET CONNECTION =====
// Auto-refresh dashboard data
function startDashboardAutoRefresh() {
  // Refresh every 10 seconds
  state.autoRefreshInterval = setInterval(async () => {
    try {
      console.log('🔄 Auto-refreshing dashboard...');
      
      // Check for current ride
      const token = localStorage.getItem('token');
      const response = await fetch('/api/driver/current-ride', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success && result.ride) {
        const ride = result.ride;
        state.currentRide = ride;
        localStorage.setItem('currentDriverRide', JSON.stringify(ride));
        
        // Show View Live Ride button if there's an active ride
        const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
        if (viewLiveRideBtn && (ride.status === 'accepted' || ride.status === 'in-progress')) {
          viewLiveRideBtn.style.display = 'block';
        }
        
        console.log('✅ Dashboard auto-refresh - found active ride:', ride._id);
      } else {
        state.currentRide = null;
        localStorage.removeItem('currentDriverRide');
        
        const viewLiveRideBtn = document.getElementById('viewLiveRideBtn');
        if (viewLiveRideBtn) {
          viewLiveRideBtn.style.display = 'none';
        }
      }
      
      // Refresh stats
      await loadTodayStats();
      
    } catch (error) {
      console.error('❌ Dashboard auto-refresh error:', error);
    }
  }, 10000);
  
  console.log('✅ Dashboard auto-refresh started (every 10 seconds)');
}

function initializeSocketConnection() {
  if (!state.driverInfo || !state.driverInfo._id) {
    console.log('Driver info not loaded yet, retrying socket connection...');
    setTimeout(initializeSocketConnection, 2000);
    return;
  }

  // Connect socket with driver ID
  driverSocketManager.connect(state.driverInfo._id);

  // Register ride request handler
  driverSocketManager.onRideRequest((rideData) => {
    console.log('📲 Ride request received in dashboard:', rideData);
    showRideRequestModal(rideData);
  });

  console.log('✅ Socket connection initialized for driver:', state.driverInfo._id);
  
  // IMPORTANT: If driver was already online when they logged in, subscribe to ride requests
  if (state.isOnline) {
    console.log('🔔 Driver is online - subscribing to ride requests...');
    // Wait a moment for socket to fully connect
    setTimeout(() => {
      if (driverSocketManager.isConnected()) {
        driverSocketManager.subscribeToRideRequests();
        console.log('✅ Auto-subscribed to ride requests on login');
      } else {
        console.warn('⚠️ Socket not connected, subscription may have failed');
      }
    }, 1000);
  }
}

// Request notification permission
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
  }
}

// ===== RIDE REQUEST MODAL =====
function showRideRequestModal(rideData) {
  const modal = document.getElementById('rideRequestModal');
  
  // Populate modal with ride data
  document.getElementById('rideRequestRiderName').textContent = rideData.rider.name;
  document.getElementById('rideRequestRiderPhone').textContent = rideData.rider.phone;
  document.getElementById('rideRequestPickup').textContent = rideData.pickup;
  document.getElementById('rideRequestDrop').textContent = rideData.drop;
  document.getElementById('rideRequestType').textContent = rideData.type;
  
  // Format time
  const createdTime = new Date(rideData.createdAt);
  const now = new Date();
  const diffSeconds = Math.floor((now - createdTime) / 1000);
  document.getElementById('rideRequestTime').textContent = diffSeconds < 5 ? 'Just now' : `${diffSeconds}s ago`;
  
  // Show modal
  modal.style.display = 'flex';
  
  // Start countdown timer (30 seconds)
  let timeLeft = 30;
  document.getElementById('rideRequestTimer').textContent = timeLeft;
  
  // Clear any existing timer
  if (state.rideRequestTimerInterval) {
    clearInterval(state.rideRequestTimerInterval);
  }
  
  state.rideRequestTimerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('rideRequestTimer').textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(state.rideRequestTimerInterval);
      closeRideRequestModal();
      showDriverNotification('Ride request expired', 'warning');
    }
  }, 1000);
  
  // Setup button handlers
  const acceptBtn = document.getElementById('acceptRideBtn');
  const rejectBtn = document.getElementById('rejectRideBtn');
  
  console.log('🔧 Setting up button handlers:', { acceptBtn, rejectBtn, rideId: rideData.rideId });
  
  if (acceptBtn) {
    acceptBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleAcceptRide(rideData.rideId);
    };
  } else {
    console.error('❌ Accept button not found!');
  }
  
  if (rejectBtn) {
    rejectBtn.onclick = () => handleRejectRide(rideData.rideId);
  } else {
    console.error('❌ Reject button not found!');
  }
}

function closeRideRequestModal() {
  const modal = document.getElementById('rideRequestModal');
  modal.style.display = 'none';
  
  // Clear timer
  if (state.rideRequestTimerInterval) {
    clearInterval(state.rideRequestTimerInterval);
    state.rideRequestTimerInterval = null;
  }
}

async function handleAcceptRide(rideId) {
  if (!rideId) {
    console.error('❌ No rideId provided');
    return;
  }
  
  const acceptBtn = document.getElementById('acceptRideBtn');
  const rejectBtn = document.getElementById('rejectRideBtn');
  
  if (acceptBtn) {
    acceptBtn.disabled = true;
    acceptBtn.textContent = '⏳ Accepting...';
  }
  if (rejectBtn) rejectBtn.disabled = true;
  
  try {
    const token = localStorage.getItem('token');
    console.log('🔑 Token check:', token ? 'EXISTS' : 'MISSING');
    
    if (!token) {
      console.error('❌ No token found, redirecting to login');
      localStorage.clear();
      window.location.href = '../../login.html';
      return;
    }

    const url = `/api/driver/rides/${rideId}/accept`;
    console.log('🌐 Accepting ride:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Response status:', response.status);
    
    if (response.status === 401) {
      console.error('❌ 401 Unauthorized - token invalid/expired');
      localStorage.clear();
      alert('Session expired. Please login again.');
      window.location.href = '../../login.html';
      return;
    }

    const result = await response.json();
    console.log('📦 Response data:', result);
    
    if (response.ok && result.success) {
      console.log('✅ Ride accepted! Redirecting...');
      closeRideRequestModal();
      window.location.href = 'live-ride.html';
    } else {
      throw new Error(result.message || 'Failed to accept ride');
    }
  } catch (error) {
    console.error('Error accepting ride:', error);
    showDriverNotification(error.message || 'Error accepting ride', 'error');
    if (acceptBtn) {
      acceptBtn.disabled = false;
      acceptBtn.textContent = '✅ Accept Ride';
    }
    if (rejectBtn) rejectBtn.disabled = false;
  }
}

function handleRejectRide(rideId) {
  console.log('❌ Rejecting ride:', rideId);
  driverSocketManager.rejectRide(rideId);
  closeRideRequestModal();
}

function showDriverNotification(message, type = 'info') {
  const toast = document.getElementById('driverNotificationToast');
  const messageEl = document.getElementById('notificationMessage');
  const iconEl = document.getElementById('notificationIcon');
  
  // Set icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  iconEl.textContent = icons[type] || icons.info;
  messageEl.textContent = message;
  
  // Show toast
  toast.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
  }
  if (state.requestTimer) {
    clearInterval(state.requestTimer);
  }
  if (state.rideRequestTimerInterval) {
    clearInterval(state.rideRequestTimerInterval);
  }
});
