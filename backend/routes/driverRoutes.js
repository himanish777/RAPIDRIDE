import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import * as driverController from "../controllers/driverController.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ===== PROFILE ROUTES =====
router.get("/profile", driverController.getDriverProfile);
router.put("/profile", driverController.updateDriverProfile);

// ===== VEHICLE SETUP ROUTES =====
router.post("/vehicle-setup", driverController.submitVehicleSetup);
router.get("/vehicle-info", driverController.getVehicleInfo);

// ===== STATUS ROUTES =====
router.post("/status", driverController.setOnlineStatus);
router.post("/location", driverController.updateLocation);

// ===== RIDE MANAGEMENT ROUTES =====
router.get("/current-ride", driverController.getCurrentRide);
router.post("/accept-ride", driverController.acceptRide);
router.post("/rides/:rideId/accept", driverController.acceptRide); // RESTful endpoint
router.post("/rides/:rideId/status", driverController.updateRideStatus); // Update ride status
router.post("/start-ride", driverController.startRide);
router.post("/complete-ride", driverController.completeRide);
router.post("/cancel-ride", driverController.cancelRide);

// ===== EARNINGS & STATISTICS ROUTES =====
router.get("/today-stats", driverController.getTodayStats);
router.get("/weekly-stats", driverController.getWeeklyStats);
router.get("/earnings-history", driverController.getEarningsHistory);
router.get("/ride-history", driverController.getRideHistory);
router.get("/performance", driverController.getPerformanceMetrics);

export default router;
