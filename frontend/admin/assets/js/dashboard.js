import AdminAPI from './api.js';

class AdminDashboard {
  constructor() {
    this.api = new AdminAPI();
    this.currentTab = 'overview';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadOverviewData();
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Profile dropdown
    document.getElementById('profileBtn').addEventListener('click', () => {
      document.getElementById('dropdownMenu').classList.toggle('active');
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshCurrentTab());

    // Filter buttons
    document.getElementById('filterRidesBtn')?.addEventListener('click', () => this.loadRides());
    document.getElementById('filterUsersBtn')?.addEventListener('click', () => this.loadUsers());
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => this.loadLogs());
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    this.currentTab = tabName;

    // Load tab data
    switch(tabName) {
      case 'overview':
        this.loadOverviewData();
        break;
      case 'metrics':
        this.loadMetrics();
        break;
      case 'rides':
        this.loadRides();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'revenue':
        this.loadRevenueData();
        break;
      case 'logs':
        this.loadLogs();
        break;
    }
  }

  async loadOverviewData() {
    try {
      const data = await this.api.getDashboardOverview();
      
      document.getElementById('totalUsers').textContent = data.users.total;
      document.getElementById('totalRides').textContent = data.rides.total;
      document.getElementById('completedRides').textContent = data.rides.completed;
      document.getElementById('activeRides').textContent = data.rides.active;
      document.getElementById('totalRevenue').textContent = data.revenue.toLocaleString();
      document.getElementById('todayRides').textContent = data.rides.today;
    } catch (error) {
      console.error('Error loading overview:', error);
      this.showError('Failed to load overview data');
    }
  }

  async loadMetrics() {
    try {
      const metricsText = await this.api.getMetrics();
      this.displayBusinessMetrics(metricsText);
      
      // Parse metrics for display (simplified)
      document.getElementById('requestRate').textContent = 'N/A (Parse from metrics)';
      document.getElementById('errorRate').textContent = 'N/A (Parse from metrics)';
      document.getElementById('avgResponseTime').textContent = 'N/A (Parse from metrics)';
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  displayBusinessMetrics(metricsText) {
    const container = document.getElementById('businessMetrics');
    
    // Extract key metrics (simplified parsing)
    const metrics = [
      { label: 'Rides Requested', value: this.extractMetric(metricsText, 'rapidride_rides_requested_total') },
      { label: 'Rides Completed', value: this.extractMetric(metricsText, 'rapidride_rides_completed_total') },
      { label: 'Rides Cancelled', value: this.extractMetric(metricsText, 'rapidride_rides_cancelled_total') },
      { label: 'User Registrations', value: this.extractMetric(metricsText, 'rapidride_user_registrations_total') },
    ];

    container.innerHTML = metrics.map(m => `
      <div class="metric-item">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
      </div>
    `).join('');
  }

  extractMetric(text, metricName) {
    const regex = new RegExp(`${metricName}\\s+(\\d+)`);
    const match = text.match(regex);
    return match ? match[1] : '0';
  }

  async loadRides(page = 1) {
    try {
      const statusFilter = document.getElementById('rideStatusFilter').value;
      const data = await this.api.getAllRides(page, 50, statusFilter || null);
      
      const tbody = document.getElementById('ridesTableBody');
      
      if (data.rides.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No rides found</td></tr>';
        return;
      }

      tbody.innerHTML = data.rides.map(ride => `
        <tr>
          <td>${ride._id.substring(0, 8)}...</td>
          <td>${ride.rider?.name || 'N/A'}</td>
          <td>${ride.driver?.name || 'Not assigned'}</td>
          <td>${ride.pickupLocation?.address || 'N/A'}</td>
          <td>${ride.dropoffLocation?.address || 'N/A'}</td>
          <td><span class="status-badge ${ride.status}">${ride.status}</span></td>
          <td>₹${ride.fare}</td>
          <td>${new Date(ride.createdAt).toLocaleDateString()}</td>
        </tr>
      `).join('');

      this.renderPagination('ridesPagination', data.pagination, (p) => this.loadRides(p));
    } catch (error) {
      console.error('Error loading rides:', error);
      this.showError('Failed to load rides: ' + error.message);
    }
  }

  async loadUsers(page = 1) {
    try {
      const roleFilter = document.getElementById('userRoleFilter').value;
      const data = await this.api.getAllUsers(page, 50, roleFilter || null);
      
      const tbody = document.getElementById('usersTableBody');
      
      if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No users found</td></tr>';
        return;
      }

      tbody.innerHTML = data.users.map(user => `
        <tr>
          <td>${user._id.substring(0, 8)}...</td>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.phone || 'N/A'}</td>
          <td>${user.role}</td>
          <td>${new Date(user.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="btn-secondary" onclick="viewUser('${user._id}')">View</button>
          </td>
        </tr>
      `).join('');

      this.renderPagination('usersPagination', data.pagination, (p) => this.loadUsers(p));
    } catch (error) {
      console.error('Error loading users:', error);
      this.showError('Failed to load users: ' + error.message);
    }
  }

  async loadRevenueData() {
    try {
      const [revenueData, popularRoutes] = await Promise.all([
        this.api.getRevenueAnalytics(30),
        this.api.getPopularRoutes(10)
      ]);

      document.getElementById('revenueTotalValue').textContent = revenueData.totalRevenue.toLocaleString();
      document.getElementById('revenueTotalTrips').textContent = revenueData.totalRides;
      document.getElementById('revenueAvgFare').textContent = Math.round(revenueData.avgFare);

      // Display popular routes
      const routesContainer = document.getElementById('popularRoutes');
      routesContainer.innerHTML = popularRoutes.map(route => `
        <div class="route-item">
          <div class="route-info">
            <div class="route-path">${route._id.pickup} → ${route._id.dropoff}</div>
            <div class="route-stats">${route.count} trips • Avg ₹${Math.round(route.avgFare)}</div>
          </div>
          <div class="route-revenue">₹${route.totalRevenue.toLocaleString()}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading revenue data:', error);
      this.showError('Failed to load revenue data');
    }
  }

  async loadLogs() {
    try {
      const levelFilter = document.getElementById('logLevelFilter').value;
      const data = await this.api.getSystemLogs(1, 100, levelFilter || null);
      
      const container = document.getElementById('logsContainer');
      container.innerHTML = '<div class="log-item info"><span class="log-timestamp">System</span><span class="log-level">INFO</span><span class="log-message">Log file reading will be implemented based on winston configuration</span></div>';
    } catch (error) {
      console.error('Error loading logs:', error);
      this.showError('Failed to load logs: ' + error.message);
    }
  }

  renderPagination(elementId, pagination, onPageChange) {
    const container = document.getElementById(elementId);
    const { page, pages } = pagination;

    container.innerHTML = `
      <button ${page === 1 ? 'disabled' : ''} onclick="dashboard.${onPageChange.name}(${page - 1})">Previous</button>
      <span>Page ${page} of ${pages}</span>
      <button ${page === pages ? 'disabled' : ''} onclick="dashboard.${onPageChange.name}(${page + 1})">Next</button>
    `;
  }

  refreshCurrentTab() {
    this.switchTab(this.currentTab);
  }

  showError(message) {
    alert(message);
  }

  logout() {
    localStorage.removeItem('token');
    window.location.href = '../../login.html';
  }
}

// Check authentication BEFORE initializing dashboard
const token = localStorage.getItem('rapidride_token') || localStorage.getItem('token');
if (!token) {
  alert('Please login first to access the admin dashboard');
  window.location.href = '../../login.html';
} else {
  // Initialize dashboard only if token exists
  const dashboard = new AdminDashboard();
  window.dashboard = dashboard; // Make available for pagination buttons
}
