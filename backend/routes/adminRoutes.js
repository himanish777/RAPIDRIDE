import express from 'express';
import * as adminController from '../controllers/adminController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to verify admin role (add after implementing role check)
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin only.' });
  }
};

// Dashboard overview
router.get('/dashboard/overview', authMiddleware, verifyAdmin, adminController.getDashboardOverview);

// Users management
router.get('/users', authMiddleware, verifyAdmin, adminController.getAllUsers);
router.get('/users/:userId', authMiddleware, verifyAdmin, adminController.getUserDetails);
router.patch('/users/:userId/status', authMiddleware, verifyAdmin, adminController.toggleUserStatus);
router.delete('/users/:userId', authMiddleware, verifyAdmin, adminController.deleteUser);
router.post('/users/:userId/restore', authMiddleware, verifyAdmin, adminController.restoreUser);

// Rides management
router.get('/rides', authMiddleware, verifyAdmin, adminController.getAllRides);
router.get('/rides/:rideId', authMiddleware, verifyAdmin, adminController.getRideDetails);

// Analytics
router.get('/analytics/revenue', authMiddleware, verifyAdmin, adminController.getRevenueAnalytics);
router.get('/analytics/rides', authMiddleware, verifyAdmin, adminController.getRideAnalytics);
router.get('/analytics/popular-routes', authMiddleware, verifyAdmin, adminController.getPopularRoutes);

// Logs
router.get('/logs', authMiddleware, verifyAdmin, adminController.getSystemLogs);

export default router;
