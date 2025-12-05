// API Configuration
export const API_BASE_URL = 'http://localhost:5500';

// API Helper Functions
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Driver API Endpoints
export const driverAPI = {
  // Profile
  getProfile: () => apiRequest('/api/driver/profile'),
  updateProfile: (data) => apiRequest('/api/driver/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  // Vehicle Setup
  submitVehicleSetup: (data) => apiRequest('/api/driver/vehicle-setup', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getVehicleInfo: () => apiRequest('/api/driver/vehicle-info'),
  
  // Status
  setOnlineStatus: (isOnline) => apiRequest('/api/driver/status', {
    method: 'POST',
    body: JSON.stringify({ isOnline }),
  }),
  updateLocation: (latitude, longitude) => apiRequest('/api/driver/location', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  }),
  
  // Stats
  getTodayStats: () => apiRequest('/api/driver/today-stats'),
  getWeeklyStats: () => apiRequest('/api/driver/weekly-stats'),
  getPerformance: () => apiRequest('/api/driver/performance'),
  
  // Rides
  getCurrentRide: () => apiRequest('/api/driver/current-ride'),
  getRideHistory: (page = 1, limit = 10) => apiRequest(`/api/driver/ride-history?page=${page}&limit=${limit}`),
  getEarningsHistory: (page = 1, limit = 10) => apiRequest(`/api/driver/earnings-history?page=${page}&limit=${limit}`),
  
  acceptRide: (rideId) => apiRequest('/api/driver/accept-ride', {
    method: 'POST',
    body: JSON.stringify({ rideId }),
  }),
  startRide: (rideId) => apiRequest('/api/driver/start-ride', {
    method: 'POST',
    body: JSON.stringify({ rideId }),
  }),
  completeRide: (rideId) => apiRequest('/api/driver/complete-ride', {
    method: 'POST',
    body: JSON.stringify({ rideId }),
  }),
  cancelRide: (rideId, reason) => apiRequest('/api/driver/cancel-ride', {
    method: 'POST',
    body: JSON.stringify({ rideId, reason }),
  }),
};
