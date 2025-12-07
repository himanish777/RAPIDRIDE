import * as adminService from '../services/adminService.js';
import logger from '../config/logger.js';
import { register, metrics } from '../config/metrics.js';
import Ride from '../models/Ride.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get dashboard overview
export const getDashboardOverview = async (req, res) => {
  try {
    const overview = await adminService.getDashboardOverviewService();
    res.status(200).json(overview);
  } catch (error) {
    logger.error('Error in getDashboardOverview', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role } = req.query;
    const result = await adminService.getAllUsersService(
      parseInt(page),
      parseInt(limit),
      role
    );
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getAllUsers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get all rides
export const getAllRides = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, startDate, endDate } = req.query;
    const result = await adminService.getAllRidesService(
      parseInt(page),
      parseInt(limit),
      status,
      startDate,
      endDate
    );
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getAllRides', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
};

// Get ride details
export const getRideDetails = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await adminService.getRideDetailsService(rideId);
    res.status(200).json(ride);
  } catch (error) {
    logger.error('Error in getRideDetails', { error: error.message });
    res.status(404).json({ error: 'Ride not found' });
  }
};

// Get user details
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.getUserDetailsService(userId);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getUserDetails', { error: error.message });
    res.status(404).json({ error: 'User not found' });
  }
};

// Get revenue analytics
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await adminService.getRevenueAnalyticsService(parseInt(days));
    res.status(200).json(analytics);
  } catch (error) {
    logger.error('Error in getRevenueAnalytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
};

// Get ride analytics
export const getRideAnalytics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const analytics = await adminService.getRideAnalyticsService(parseInt(days));
    res.status(200).json(analytics);
  } catch (error) {
    logger.error('Error in getRideAnalytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch ride analytics' });
  }
};

// Get system logs
export const getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 100, level } = req.query;
    const result = await adminService.getSystemLogsService(
      parseInt(page),
      parseInt(limit),
      level
    );
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getSystemLogs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
};

// Toggle user status (block/unblock)
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;
    const user = await adminService.toggleUserStatusService(userId, isBlocked);
    res.status(200).json(user);
  } catch (error) {
    logger.error('Error in toggleUserStatus', { error: error.message });
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// Get popular routes
export const getPopularRoutes = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const routes = await adminService.getPopularRoutesService(parseInt(limit));
    res.status(200).json(routes);
  } catch (error) {
    logger.error('Error in getPopularRoutes', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch popular routes' });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.deleteUserService(userId);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in deleteUser', { error: error.message });
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Restore user
export const restoreUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.restoreUserService(userId);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in restoreUser', { error: error.message });
    res.status(500).json({ error: 'Failed to restore user' });
  }
};

// Get Prometheus metrics for monitoring dashboard
export const getMetrics = async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    logger.error('Error in getMetrics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

// Get parsed metrics data for charts
export const getMetricsData = async (req, res) => {
  try {
    // Sync active rides gauge with actual database count BEFORE getting metrics
    const activeRidesCount = await Ride.countDocuments({
      status: { $in: ['searching', 'assigned', 'arriving', 'on_trip'] }
    });
    
    // Set gauge to actual count (instead of using inc/dec which can drift)
    metrics.activeRidesGauge.set(activeRidesCount);
    
    const metricsString = await register.metrics();
    const metricsArray = metricsString.split('\n').filter(line => 
      line && !line.startsWith('#')
    );
    
    const parsedMetrics = {};
    metricsArray.forEach(line => {
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?.*?\}?\s+(.+)$/);
      if (match) {
        const [, name, value] = match;
        const cleanName = name.split('{')[0]; // Remove label part
        parsedMetrics[cleanName] = parseFloat(value) || 0;
      }
    });

    // Log for debugging
    logger.info('Parsed metrics:', { parsedMetrics, actualActiveRides: activeRidesCount });

    // Extract business metrics
    const businessMetrics = {
      rides: {
        requested: parsedMetrics['rapidride_rides_requested_total'] || 0,
        completed: parsedMetrics['rapidride_rides_completed_total'] || 0,
        cancelled: parsedMetrics['rapidride_rides_cancelled_total'] || 0,
        active: parsedMetrics['rapidride_active_rides'] || 0,
      },
      users: {
        active: parsedMetrics['rapidride_active_users'] || 0,
        totalRegistrations: parsedMetrics['rapidride_user_registrations_total'] || 0,
      },
      system: {
        apiUp: parsedMetrics['up'] || 1, // Default to 1 (up) if not found
        errors: parsedMetrics['rapidride_api_errors_total'] || 0,
        loginAttempts: parsedMetrics['rapidride_login_attempts_total'] || 0,
      },
      performance: {
        avgDbQuery: parsedMetrics['rapidride_db_query_duration_seconds_sum'] || 0,
      }
    };

    logger.info('Business metrics:', { businessMetrics });

    res.json({ success: true, metrics: businessMetrics, timestamp: Date.now() });
  } catch (error) {
    logger.error('Error in getMetricsData', { error: error.message });
    res.status(500).json({ error: 'Failed to parse metrics data' });
  }
};

// Get system logs
export const getLogs = async (req, res) => {
  try {
    const { type = 'combined', limit = 100 } = req.query;
    const logFile = type === 'error' ? 'error.log' : 'combined.log';
    const logPath = path.join(__dirname, '../logs', logFile);

    let content = '';
    try {
      content = await fs.readFile(logPath, 'utf-8');
    } catch (err) {
      // If file doesn't exist yet
      return res.json({ success: true, logs: [], count: 0 });
    }

    const lines = content.trim().split('\n').filter(line => line);
    const recentLines = lines.slice(-limit);
    
    const logs = recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line, level: 'info' };
      }
    }).reverse();

    res.json({ success: true, logs, count: logs.length });
  } catch (error) {
    logger.error('Error in getLogs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// Get analytics data (revenue, ride trends, etc.)
export const getAnalytics = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const analytics = await adminService.getAnalyticsService(period);
    res.json({ success: true, analytics });
  } catch (error) {
    logger.error('Error in getAnalytics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

