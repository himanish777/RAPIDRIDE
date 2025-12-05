// Admin API Client
class AdminAPI {
  constructor() {
    this.baseURL = 'http://localhost:5500';
    this.token = localStorage.getItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token ? `Bearer ${this.token}` : '',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          localStorage.removeItem('token');
          alert('Session expired. Please login again.');
          window.location.href = '../../login.html';
          throw new Error('Unauthorized');
        }
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required. Please contact administrator to upgrade your account.');
        }
        throw new Error(data.error || data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Dashboard
  async getDashboardOverview() {
    return this.request('/api/admin/dashboard/overview');
  }

  // Users
  async getAllUsers(page = 1, limit = 50, role = null) {
    const params = new URLSearchParams({ page, limit });
    if (role) params.append('role', role);
    return this.request(`/api/admin/users?${params}`);
  }

  async getUserDetails(userId) {
    return this.request(`/api/admin/users/${userId}`);
  }

  async toggleUserStatus(userId, isBlocked) {
    return this.request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isBlocked }),
    });
  }

  // Rides
  async getAllRides(page = 1, limit = 50, status = null, startDate = null, endDate = null) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/api/admin/rides?${params}`);
  }

  async getRideDetails(rideId) {
    return this.request(`/api/admin/rides/${rideId}`);
  }

  // Analytics
  async getRevenueAnalytics(days = 30) {
    return this.request(`/api/admin/analytics/revenue?days=${days}`);
  }

  async getRideAnalytics(days = 7) {
    return this.request(`/api/admin/analytics/rides?days=${days}`);
  }

  async getPopularRoutes(limit = 10) {
    return this.request(`/api/admin/analytics/popular-routes?limit=${limit}`);
  }

  // Logs
  async getSystemLogs(page = 1, limit = 100, level = null) {
    const params = new URLSearchParams({ page, limit });
    if (level) params.append('level', level);
    return this.request(`/api/admin/logs?${params}`);
  }

  // Metrics
  async getMetrics() {
    const response = await fetch(`${this.baseURL}/metrics`);
    return response.text();
  }
}

export default AdminAPI;
