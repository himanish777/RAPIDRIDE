import * as driverService from "../services/driverService.js";
import logger from '../config/logger.js';

// ===== DRIVER PROFILE CONTROLLERS =====
export const getDriverProfile = async (req, res) => {
  try {
    const result = await driverService.getDriverProfileService(req.user.userId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('getDriverProfile error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateDriverProfile = async (req, res) => {
  try {
    const result = await driverService.updateDriverProfileService(req.user.userId, req.body);
    return res.json(result);
  } catch (err) {
    logger.error('updateDriverProfile error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== VEHICLE SETUP CONTROLLERS =====
export const submitVehicleSetup = async (req, res) => {
  try {
    const result = await driverService.submitVehicleSetupService(req.user.userId, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('submitVehicleSetup error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getVehicleInfo = async (req, res) => {
  try {
    const result = await driverService.getVehicleInfoService(req.user.userId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('getVehicleInfo error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== ONLINE/OFFLINE STATUS CONTROLLERS =====
export const setOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const result = await driverService.setOnlineStatusService(req.user.userId, isOnline);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('setOnlineStatus error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const result = await driverService.updateLocationService(req.user.userId, { latitude, longitude });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('updateLocation error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== RIDE MANAGEMENT CONTROLLERS =====
export const getCurrentRide = async (req, res) => {
  try {
    const result = await driverService.getCurrentRideService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getCurrentRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const acceptRide = async (req, res) => {
  try {
    const rideId = req.body.rideId || req.params.rideId;
    const result = await driverService.acceptRideService(req.user.userId, rideId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('acceptRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;
    const result = await driverService.updateRideStatusService(req.user.userId, rideId, status);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('updateRideStatus error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const startRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    const result = await driverService.startRideService(req.user.userId, rideId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('startRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const completeRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    const result = await driverService.completeRideService(req.user.userId, rideId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('completeRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const cancelRide = async (req, res) => {
  try {
    const { rideId, reason } = req.body;
    const result = await driverService.cancelRideService(req.user.userId, rideId, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('cancelRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== EARNINGS & STATISTICS CONTROLLERS =====
export const getTodayStats = async (req, res) => {
  try {
    const result = await driverService.getTodayStatsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getTodayStats error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getWeeklyStats = async (req, res) => {
  try {
    const result = await driverService.getWeeklyStatsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getWeeklyStats error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getEarningsHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await driverService.getEarningsHistoryService(req.user.userId, page, limit);
    return res.json(result);
  } catch (err) {
    logger.error('getEarningsHistory error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await driverService.getRideHistoryService(req.user.userId, page, limit);
    return res.json(result);
  } catch (err) {
    logger.error('getRideHistory error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPerformanceMetrics = async (req, res) => {
  try {
    const result = await driverService.getPerformanceMetricsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getPerformanceMetrics error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
