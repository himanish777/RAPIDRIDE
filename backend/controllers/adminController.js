import * as adminService from '../services/adminService.js';
import logger from '../config/logger.js';

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
