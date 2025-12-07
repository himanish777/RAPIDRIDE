// Monitoring Module - Real-time metrics & logs visualization
import { API } from './api.js';

class MonitoringDashboard {
  constructor() {
    this.api = new API();
    this.charts = {};
    this.refreshInterval = null;
    this.logsRefreshInterval = null;
    this.metricsData = null;
    
    this.init();
  }

  init() {
    // Initialize charts when metrics tab is shown
    this.setupTabListeners();
    this.setupEventListeners();
  }

  setupTabListeners() {
    const metricsTab = document.querySelector('[data-tab="metrics"]');
    if (metricsTab) {
      metricsTab.addEventListener('click', () => {
        setTimeout(() => {
          if (!this.charts.ridesChart) {
            this.initializeCharts();
          }
          this.loadMetricsData();
          this.loadLogs();
          this.startAutoRefresh();
        }, 100);
      });
    }

    // Stop refresh when leaving metrics tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab !== 'metrics') {
          this.stopAutoRefresh();
        }
      });
    });
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('refreshMetricsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshAll());
    }

    const clearLogsBtn = document.getElementById('clearLogsBtn');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => this.clearLogs());
    }

    const logTypeFilter = document.getElementById('logTypeFilter');
    if (logTypeFilter) {
      logTypeFilter.addEventListener('change', () => this.loadLogs());
    }

    const logLevelFilter = document.getElementById('logLevelFilter');
    if (logLevelFilter) {
      logLevelFilter.addEventListener('change', () => this.filterLogs());
    }
  }

  initializeCharts() {
    // Grafana-inspired color scheme
    const colors = {
      primary: '#10B981',    // Emerald
      secondary: '#06B6D4',  // Cyan
      warning: '#F59E0B',    // Amber
      danger: '#EF4444',     // Red
      success: '#22C55E',    // Green
      purple: '#A855F7',     // Purple
      grid: 'rgba(148, 163, 184, 0.1)',
      text: '#CBD5E1',
    };

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: colors.text,
            font: { size: 12, family: "'Inter', sans-serif" },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: colors.primary,
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              label += context.parsed.y !== null ? context.parsed.y : context.parsed;
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: { color: colors.text }
        },
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.text }
        }
      }
    };

    // Rides Overview Chart (Bar Chart)
    const ridesCtx = document.getElementById('ridesChart');
    if (ridesCtx) {
      this.charts.ridesChart = new Chart(ridesCtx, {
        type: 'bar',
        data: {
          labels: ['Requested', 'Completed', 'Cancelled', 'Active'],
          datasets: [{
            label: 'Rides',
            data: [0, 0, 0, 0],
            backgroundColor: [
              colors.secondary,
              colors.success,
              colors.danger,
              colors.warning
            ],
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          ...chartDefaults,
          plugins: {
            ...chartDefaults.plugins,
            legend: { display: false }
          }
        }
      });
    }

    // System Health Chart (Doughnut)
    const healthCtx = document.getElementById('systemHealthChart');
    if (healthCtx) {
      this.charts.systemHealthChart = new Chart(healthCtx, {
        type: 'doughnut',
        data: {
          labels: ['Uptime', 'Downtime'],
          datasets: [{
            data: [99.9, 0.1],
            backgroundColor: [colors.success, colors.danger],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: colors.text,
                font: { size: 12 },
                padding: 15
              }
            }
          }
        }
      });
    }

    // User Activity Chart (Line Chart)
    const activityCtx = document.getElementById('userActivityChart');
    if (activityCtx) {
      this.charts.userActivityChart = new Chart(activityCtx, {
        type: 'line',
        data: {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
          datasets: [{
            label: 'Active Users',
            data: [0, 0, 0, 0, 0, 0],
            borderColor: colors.primary,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.primary,
          }]
        },
        options: chartDefaults
      });
    }

    // Performance Chart (Line Chart with multiple datasets)
    const perfCtx = document.getElementById('performanceChart');
    if (perfCtx) {
      this.charts.performanceChart = new Chart(perfCtx, {
        type: 'line',
        data: {
          labels: ['1m', '5m', '10m', '15m', '20m', '30m'],
          datasets: [
            {
              label: 'API Response Time (ms)',
              data: [0, 0, 0, 0, 0, 0],
              borderColor: colors.secondary,
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Error Rate (%)',
              data: [0, 0, 0, 0, 0, 0],
              borderColor: colors.danger,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: true,
              tension: 0.4,
            }
          ]
        },
        options: chartDefaults
      });
    }
  }

  async loadMetricsData() {
    try {
      console.log('📊 Loading metrics data...');
      const response = await this.api.getMetricsData();
      console.log('📊 Metrics response:', response);
      if (response.success) {
        this.metricsData = response.metrics;
        console.log('📊 Metrics data:', this.metricsData);
        this.updateKPIs();
        this.updateCharts();
      }
    } catch (error) {
      console.error('❌ Failed to load metrics:', error);
      this.displayMetricsError();
    }
  }

  displayMetricsError() {
    // Show error in KPIs
    this.setKPI('kpiActiveRides', 'N/A');
    this.setKPI('kpiActiveUsers', 'N/A');
    this.setKPI('kpiCompletedRides', 'N/A');
    this.setKPI('kpiApiStatus', 'ERROR');
  }

  updateKPIs() {
    if (!this.metricsData) return;

    const { rides, users, system } = this.metricsData;

    // Update KPI values
    this.setKPI('kpiActiveRides', rides.active || 0);
    this.setKPI('kpiActiveUsers', users.active || 0);
    this.setKPI('kpiCompletedRides', rides.completed || 0);
    this.setKPI('kpiApiStatus', system.apiUp === 1 ? 'UP' : 'DOWN');

    // Update API status color
    const apiStatusEl = document.getElementById('kpiApiStatus');
    if (apiStatusEl) {
      apiStatusEl.style.color = system.apiUp === 1 ? '#22C55E' : '#EF4444';
    }
  }

  setKPI(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      el.classList.add('kpi-update');
      setTimeout(() => el.classList.remove('kpi-update'), 500);
    }
  }

  updateCharts() {
    if (!this.metricsData) return;

    const { rides, users } = this.metricsData;

    // Update Rides Chart
    if (this.charts.ridesChart) {
      this.charts.ridesChart.data.datasets[0].data = [
        rides.requested || 0,
        rides.completed || 0,
        rides.cancelled || 0,
        rides.active || 0
      ];
      this.charts.ridesChart.update('none');
    }

    // Update User Activity Chart (simulated data for now)
    if (this.charts.userActivityChart) {
      const activeUsers = users.active || 0;
      const variance = activeUsers * 0.2;
      this.charts.userActivityChart.data.datasets[0].data = [
        Math.max(0, activeUsers - variance * 2),
        Math.max(0, activeUsers - variance),
        activeUsers,
        activeUsers + variance,
        activeUsers + variance * 1.5,
        activeUsers + variance * 0.5
      ];
      this.charts.userActivityChart.update('none');
    }

    // Update Performance Chart (simulated)
    if (this.charts.performanceChart) {
      const avgResponse = this.metricsData.performance?.avgDbQuery || 0.05;
      this.charts.performanceChart.data.datasets[0].data = [
        avgResponse * 1000 * 0.8,
        avgResponse * 1000 * 0.9,
        avgResponse * 1000,
        avgResponse * 1000 * 1.1,
        avgResponse * 1000 * 0.95,
        avgResponse * 1000
      ];
      
      const errorRate = this.metricsData.system?.errors || 0;
      this.charts.performanceChart.data.datasets[1].data = [
        errorRate * 0.5,
        errorRate * 0.7,
        errorRate,
        errorRate * 1.2,
        errorRate * 0.9,
        errorRate * 0.8
      ];
      this.charts.performanceChart.update('none');
    }
  }

  async loadLogs() {
    try {
      console.log('📝 Loading logs...');
      const logType = document.getElementById('logTypeFilter')?.value || 'combined';
      const response = await this.api.getMonitoringLogs(logType, 50);
      console.log('📝 Logs response:', response);
      
      if (response.success) {
        this.displayLogs(response.logs);
      }
    } catch (error) {
      console.error('❌ Failed to load logs:', error);
      this.displayLogsError();
    }
  }

  displayLogs(logs) {
    const container = document.getElementById('logsContainer');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="logs-empty">No logs available</div>';
      return;
    }

    container.innerHTML = logs.map(log => {
      const level = log.level || 'info';
      const timestamp = log.timestamp || new Date().toISOString();
      const message = log.message || JSON.stringify(log);
      const service = log.service || 'rapidride-api';

      return `
        <div class="log-entry log-${level}" data-level="${level}">
          <span class="log-time">${this.formatLogTime(timestamp)}</span>
          <span class="log-level-badge log-level-${level}">${level.toUpperCase()}</span>
          <span class="log-service">[${service}]</span>
          <span class="log-message">${this.escapeHtml(message)}</span>
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  displayLogsError() {
    const container = document.getElementById('logsContainer');
    if (container) {
      container.innerHTML = '<div class="logs-error">Failed to load logs. Check server connection.</div>';
    }
  }

  filterLogs() {
    const levelFilter = document.getElementById('logLevelFilter')?.value;
    const logEntries = document.querySelectorAll('.log-entry');

    logEntries.forEach(entry => {
      if (!levelFilter || entry.dataset.level === levelFilter) {
        entry.style.display = 'flex';
      } else {
        entry.style.display = 'none';
      }
    });
  }

  clearLogs() {
    const container = document.getElementById('logsContainer');
    if (container) {
      container.innerHTML = '<div class="logs-empty">Logs cleared</div>';
    }
  }

  formatLogTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refreshAll() {
    await Promise.all([
      this.loadMetricsData(),
      this.loadLogs()
    ]);
  }

  startAutoRefresh() {
    // Refresh metrics every 5 seconds
    this.refreshInterval = setInterval(() => {
      this.loadMetricsData();
    }, 5000);

    // Refresh logs every 10 seconds
    this.logsRefreshInterval = setInterval(() => {
      this.loadLogs();
    }, 10000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.logsRefreshInterval) {
      clearInterval(this.logsRefreshInterval);
      this.logsRefreshInterval = null;
    }
  }
}

// Initialize monitoring dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MonitoringDashboard();
  });
} else {
  new MonitoringDashboard();
}

export default MonitoringDashboard;
