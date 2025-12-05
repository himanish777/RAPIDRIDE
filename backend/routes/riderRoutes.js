import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
// import { cacheMiddleware } from '../middleware/cacheMiddleware.js';
import * as riderCtrl from '../controllers/riderController.js';

const router = express.Router();

// Profile
router.get('/profile', authMiddleware, riderCtrl.getUserProfile);
router.put('/profile', authMiddleware, riderCtrl.updateUserProfile);

// Rides - IMPORTANT: Specific routes MUST come before parameterized routes (:id)
router.post('/rides/request', authMiddleware, riderCtrl.requestRide);
router.get('/rides/current', authMiddleware, riderCtrl.getCurrentRide);
router.get('/rides/history', authMiddleware, riderCtrl.getRideHistory);
router.post('/rides/estimate-fare', authMiddleware, riderCtrl.estimateFare);
router.post('/rides/schedule', authMiddleware, riderCtrl.scheduleRide);
router.get('/rides/scheduled', authMiddleware, riderCtrl.getScheduledRides);
router.get('/rides/:id', authMiddleware, riderCtrl.getRideDetails);
router.post('/rides/:id/cancel', authMiddleware, riderCtrl.cancelRide);

// Rewards / coupons
router.get('/rewards/points', authMiddleware, riderCtrl.getRewardPoints);
router.post('/coupons/apply', authMiddleware, riderCtrl.applyCoupon);

// Notifications
router.get('/notifications', authMiddleware, riderCtrl.getNotifications);
router.put('/notifications/:id/read', authMiddleware, riderCtrl.markNotificationRead);

// Support
router.post('/support/request', authMiddleware, riderCtrl.submitSupportRequest);

// Emergency
router.post('/emergency/sos', authMiddleware, riderCtrl.triggerSOS);

// Analytics
router.get('/analytics/rides', authMiddleware, riderCtrl.getRideAnalytics);

// Invoice
router.get('/rides/:id/invoice', authMiddleware, riderCtrl.getInvoice);

export default router;
