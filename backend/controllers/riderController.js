import * as riderService from "../services/riderService.js";
import logger from '../config/logger.js';

// ===== USER PROFILE CONTROLLERS =====
export const getUserProfile = async (req, res) => {
  try {
    const result = await riderService.getUserProfileService(req.user.userId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('getUserProfile error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const result = await riderService.updateUserProfileService(req.user.userId, req.body);
    return res.json(result);
  } catch (err) {
    logger.error('updateUserProfile error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== RIDE CONTROLLERS =====
export const requestRide = async (req, res) => {
  try {
    const result = await riderService.requestRideService(req.user.userId, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err) {
    logger.error('requestRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getCurrentRide = async (req, res) => {
  try {
    const result = await riderService.getCurrentRideService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getCurrentRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRideDetails = async (req, res) => {
  try {
    const result = await riderService.getRideDetailsService(req.user.userId, req.params.id);
    if (!result.success) {
      const statusCode = result.message === 'Ride not found' ? 404 : 403;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('getRideDetails error', { error: err.message, userId: req.user.userId, rideId: req.params.id });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const cancelRide = async (req, res) => {
  try {
    const result = await riderService.cancelRideService(req.user.userId, req.params.id);
    if (!result.success) {
      const statusCode = result.message === 'Ride not found' ? 404 : 
                        result.message === 'Forbidden' ? 403 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('cancelRide error', { error: err.message, userId: req.user.userId, rideId: req.params.id });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await riderService.getRideHistoryService(req.user.userId, page, limit);
    return res.json(result);
  } catch (err) {
    logger.error('getRideHistory error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const estimateFare = async (req, res) => {
  try {
    const result = await riderService.estimateFareService(req.body);
    return res.json(result);
  } catch (err) {
    logger.error('estimateFare error', { error: err.message });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const scheduleRide = async (req, res) => {
  try {
    const result = await riderService.scheduleRideService(req.user.userId, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err) {
    logger.error('scheduleRide error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getScheduledRides = async (req, res) => {
  try {
    const result = await riderService.getScheduledRidesService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getScheduledRides error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== REWARDS & COUPONS CONTROLLERS =====
export const getRewardPoints = async (req, res) => {
  try {
    const result = await riderService.getRewardPointsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getRewardPoints error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const applyCoupon = async (req, res) => {
  try {
    const result = await riderService.applyCouponService(req.user.userId, req.body.code);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('applyCoupon error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== NOTIFICATION CONTROLLERS =====
export const getNotifications = async (req, res) => {
  try {
    const result = await riderService.getNotificationsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getNotifications error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const result = await riderService.markNotificationReadService(req.user.userId, req.params.id);
    return res.json(result);
  } catch (err) {
    logger.error('markNotificationRead error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== SUPPORT CONTROLLERS =====
export const submitSupportRequest = async (req, res) => {
  try {
    const result = await riderService.submitSupportRequestService(req.user.userId, req.body);
    return res.status(201).json(result);
  } catch (err) {
    logger.error('submitSupportRequest error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== EMERGENCY CONTROLLERS =====
export const triggerSOS = async (req, res) => {
  try {
    const result = await riderService.triggerSOSService(req.user.userId, req.body.location);
    return res.json(result);
  } catch (err) {
    logger.error('triggerSOS error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== ANALYTICS CONTROLLERS =====
export const getRideAnalytics = async (req, res) => {
  try {
    const result = await riderService.getRideAnalyticsService(req.user.userId);
    return res.json(result);
  } catch (err) {
    logger.error('getRideAnalytics error', { error: err.message, userId: req.user.userId });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== INVOICE CONTROLLERS =====
export const getInvoice = async (req, res) => {
  try {
    const result = await riderService.getInvoiceService(req.user.userId, req.params.id);
    if (!result.success) {
      const statusCode = result.message === 'Ride not found' ? 404 : 403;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (err) {
    logger.error('getInvoice error', { error: err.message, userId: req.user.userId, rideId: req.params.id });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
