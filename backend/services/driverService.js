import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import logger from '../config/logger.js';
import { metrics } from '../config/metrics.js';
import { emitToAdmin, emitToRide, emitToDrivers } from '../config/socketHelper.js';
import NotificationService from './notificationService.js';

// ===== DRIVER PROFILE SERVICES =====
export const getDriverProfileService = async (driverId) => {
  try {
    const driver = await Driver.findById(driverId).select('-password');
    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }
    return { success: true, driver };
  } catch (err) {
    logger.error('getDriverProfileService error', { error: err.message, driverId });
    throw err;
  }
};

export const updateDriverProfileService = async (driverId, updates) => {
  try {
    // Don't allow updating sensitive fields directly
    const allowedUpdates = ['name', 'phone', 'profilePhoto', 'languages', 'emergencyContact', 'bankDetails'];
    const filteredUpdates = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    const driver = await Driver.findByIdAndUpdate(driverId, filteredUpdates, { new: true }).select('-password');
    return { success: true, driver };
  } catch (err) {
    logger.error('updateDriverProfileService error', { error: err.message, driverId });
    throw err;
  }
};

// ===== VEHICLE SETUP SERVICES =====
export const submitVehicleSetupService = async (driverId, vehicleData) => {
  try {
    const { type, make, model, number, color, year, license, insurance } = vehicleData;

    // Validate required fields
    if (!type || !make || !model || !number || !color || !year || !license || !insurance) {
      return { success: false, message: 'All vehicle fields are required' };
    }

    // Check if vehicle number already exists
    const existingVehicle = await Driver.findOne({ 
      'vehicle.number': number.toUpperCase(),
      _id: { $ne: driverId }
    });

    if (existingVehicle) {
      return { success: false, message: 'Vehicle number already registered' };
    }

    // Update driver with vehicle information
    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        vehicle: {
          type,
          make,
          model,
          number: number.toUpperCase(),
          color,
          year: parseInt(year)
        },
        license: {
          number: license.toUpperCase()
        },
        insurance: {
          policyNumber: insurance
        },
        vehicleSetupComplete: true
      },
      { new: true }
    ).select('-password');

    logger.info('Vehicle setup completed', { driverId, vehicleNumber: number });
    
    // Emit event to admin
    emitToAdmin('driver:vehicle_setup', {
      driverId,
      vehicleNumber: number,
      vehicleType: type
    });

    return { success: true, driver, message: 'Vehicle setup completed successfully' };
  } catch (err) {
    logger.error('submitVehicleSetupService error', { error: err.message, driverId });
    throw err;
  }
};

export const getVehicleInfoService = async (driverId) => {
  try {
    const driver = await Driver.findById(driverId).select('vehicle license insurance vehicleSetupComplete');
    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }
    return { 
      success: true, 
      vehicle: driver.vehicle,
      license: driver.license,
      insurance: driver.insurance,
      setupComplete: driver.vehicleSetupComplete
    };
  } catch (err) {
    logger.error('getVehicleInfoService error', { error: err.message, driverId });
    throw err;
  }
};

// ===== ONLINE/OFFLINE STATUS SERVICES =====
export const setOnlineStatusService = async (driverId, isOnline) => {
  try {
    const driver = await Driver.findById(driverId);
    
    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }

    // Check if vehicle setup is complete before going online
    if (isOnline && !driver.vehicleSetupComplete) {
      return { success: false, message: 'Please complete vehicle setup before going online' };
    }

    driver.isOnline = isOnline;
    driver.isAvailable = isOnline; // When going online, set as available
    await driver.save();

    logger.info('Driver status updated', { driverId, isOnline });
    
    // Emit event to admin
    emitToAdmin('driver:status_changed', {
      driverId,
      isOnline,
      timestamp: new Date()
    });

    return { success: true, isOnline, message: `Driver is now ${isOnline ? 'online' : 'offline'}` };
  } catch (err) {
    logger.error('setOnlineStatusService error', { error: err.message, driverId });
    throw err;
  }
};

export const updateLocationService = async (driverId, { latitude, longitude }) => {
  try {
    if (!latitude || !longitude) {
      return { success: false, message: 'Latitude and longitude are required' };
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        currentLocation: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      },
      { new: true }
    );

    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }

    return { success: true, message: 'Location updated' };
  } catch (err) {
    logger.error('updateLocationService error', { error: err.message, driverId });
    throw err;
  }
};

// ===== RIDE MANAGEMENT SERVICES =====
export const getCurrentRideService = async (driverId) => {
  try {
    const ride = await Ride.findOne({ 
      driver: driverId, 
      status: { $nin: ['completed', 'cancelled'] } 
    })
    .sort({ createdAt: -1 })
    .populate('rider', 'name phone rating');
    
    return { success: true, ride };
  } catch (err) {
    logger.error('getCurrentRideService error', { error: err.message, driverId });
    throw err;
  }
};

export const acceptRideService = async (driverId, rideId) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (ride.status !== 'searching') {
      return { success: false, message: 'Ride is no longer available' };
    }

    // Check if driver is online and available
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }
    if (!driver.isOnline || !driver.isAvailable) {
      return { success: false, message: 'Driver must be online and available' };
    }

    ride.driver = driverId;
    ride.status = 'assigned';
    ride.acceptedAt = new Date();
    await ride.save();

    // Set driver as unavailable
    driver.isAvailable = false;
    await driver.save();

    logger.info('Ride accepted', { driverId, rideId });
    
    // Track metric
    metrics.ridesRequestedCounter.inc({ status: 'assigned' });
    
    // Emit events
    emitToAdmin('ride:accepted', { rideId, driverId });
    emitToRide(rideId, 'ride:status_changed', { status: 'assigned', ride });
    
    // Notify all other drivers that this ride was accepted
    emitToDrivers('ride:acceptedByOther', { rideId });
    console.log(`✅ Ride ${rideId} accepted by driver ${driverId}, notifying other drivers`);
    
    // Send notifications
    await NotificationService.notifyRideAcceptedSuccess(driverId, rideId, ride.pickupLocation.address);
    await NotificationService.notifyDriverAccepted(ride.rider, rideId, driver.name);

    return { success: true, ride, message: 'Ride accepted successfully' };
  } catch (err) {
    logger.error('acceptRideService error', { error: err.message, driverId, rideId });
    throw err;
  }
};

export const updateRideStatusService = async (driverId, rideId, status) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (String(ride.driver) !== driverId) {
      return { success: false, message: 'Unauthorized' };
    }

    const validStatuses = ['assigned', 'arriving', 'waiting', 'on_trip', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return { success: false, message: 'Invalid status' };
    }

    ride.status = status;
    
    // Set timestamps based on status
    if (status === 'waiting') {
      ride.arrivedAt = new Date();
    } else if (status === 'on_trip') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
    }
    
    await ride.save();

    logger.info('Ride status updated', { driverId, rideId, status });
    
    // Emit events
    emitToAdmin('ride:status_changed', { rideId, driverId, status });
    emitToRide(rideId, 'ride:status_changed', { status, ride });
    
    // Get driver info for notifications
    const driver = await Driver.findById(driverId).select('name');
    
    // Send status-specific notifications to rider
    if (status === 'arriving') {
      await NotificationService.notifyDriverOnWay(ride.rider, rideId, driver.name, 5);
    } else if (status === 'waiting') {
      await NotificationService.notifyDriverArrived(ride.rider, rideId, driver.name);
    }

    return { success: true, ride, message: `Ride status updated to ${status}` };
  } catch (err) {
    logger.error('updateRideStatusService error', { error: err.message, driverId, rideId });
    throw err;
  }
};

export const startRideService = async (driverId, rideId) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (String(ride.driver) !== driverId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (ride.status !== 'assigned' && ride.status !== 'arriving' && ride.status !== 'waiting') {
      return { success: false, message: 'Ride cannot be started' };
    }

    ride.status = 'on_trip';
    ride.startedAt = new Date();
    await ride.save();

    logger.info('Ride started', { driverId, rideId });
    
    // Emit events
    emitToAdmin('ride:started', { rideId, driverId });
    emitToRide(rideId, 'ride:status_changed', { status: 'on_trip', ride });
    
    // Send notifications
    await NotificationService.notifyTripStarted(ride.rider, rideId);

    return { success: true, ride, message: 'Ride started' };
  } catch (err) {
    logger.error('startRideService error', { error: err.message, driverId, rideId });
    throw err;
  }
};

export const completeRideService = async (driverId, rideId) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (String(ride.driver) !== driverId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (ride.status !== 'on_trip') {
      return { success: false, message: 'Ride is not in progress' };
    }

    ride.status = 'completed';
    ride.completedAt = new Date();
    
    // Calculate fare (simple calculation - can be enhanced)
    const distance = Math.random() * 20 + 5; // Simulated distance in km
    const baseFare = 50;
    const perKm = 15;
    ride.fare = baseFare + (distance * perKm);
    ride.distance = distance;
    
    await ride.save();

    // Update driver stats
    const driver = await Driver.findById(driverId);
    driver.totalRides += 1;
    driver.completedRides += 1;
    driver.totalEarnings += ride.fare;
    driver.totalDistance += distance;
    driver.isAvailable = true; // Back to available
    await driver.save();

    logger.info('Ride completed', { driverId, rideId, fare: ride.fare });
    
    // Track metrics
    metrics.ridesCompletedCounter.inc();
    metrics.activeRidesGauge.dec();
    
    // Emit events
    emitToAdmin('ride:completed', { rideId, driverId, fare: ride.fare });
    emitToRide(rideId, 'ride:status_changed', { status: 'completed', ride });
    

    // Send notifications
    await NotificationService.notifyTripEnded(ride.rider, rideId, ride.fare);
    await NotificationService.notifyTripEndedSuccess(driverId, rideId, ride.fare);

    // Notify rider about payment success (for all payment methods)
    await NotificationService.notifyPaymentSuccess(ride.rider, rideId, ride.fare);

    // Notify about payment collection (if cash)
    if (ride.paymentMethod === 'cash' || !ride.paymentMethod) {
      await NotificationService.notifyCashCollect(driverId, rideId, ride.fare);
    }

    return { success: true, ride, message: 'Ride completed successfully' };
  } catch (err) {
    logger.error('completeRideService error', { error: err.message, driverId, rideId });
    throw err;
  }
};

export const cancelRideService = async (driverId, rideId, reason) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    if (String(ride.driver) !== driverId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return { success: false, message: 'Cannot cancel this ride' };
    }

    ride.status = 'cancelled';
    ride.cancellationReason = reason || 'Driver cancelled';
    ride.cancelledBy = 'driver';
    await ride.save();

    // Update driver stats
    const driver = await Driver.findById(driverId);
    driver.cancelledRides += 1;
    driver.isAvailable = true; // Back to available
    await driver.save();

    logger.info('Ride cancelled by driver', { driverId, rideId, reason });
    
    // Track metrics
    metrics.ridesCancelledCounter.inc({ cancelled_by: 'driver' });
    metrics.activeRidesGauge.dec();
    
    // Emit events
    emitToAdmin('ride:cancelled', { rideId, driverId, cancelledBy: 'driver' });
    emitToRide(rideId, 'ride:status_changed', { status: 'cancelled', ride });
    
    // Send notification to rider
    await NotificationService.notifyDriverCancelled(ride.rider, rideId, driver.name);

    return { success: true, ride, message: 'Ride cancelled' };
  } catch (err) {
    logger.error('cancelRideService error', { error: err.message, driverId, rideId });
    throw err;
  }
};

// ===== EARNINGS & STATISTICS SERVICES =====
export const getTodayStatsService = async (driverId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rides = await Ride.find({
      driver: driverId,
      status: 'completed',
      completedAt: { $gte: today }
    });

    const earnings = rides.reduce((sum, ride) => sum + (ride.fare || 0), 0);
    const totalRides = rides.length;

    // Calculate online hours (simplified - would need proper tracking)
    const onlineHours = Math.random() * 8; // Simulated

    return {
      success: true,
      stats: {
        earnings,
        rides: totalRides,
        onlineHours: onlineHours.toFixed(1)
      }
    };
  } catch (err) {
    logger.error('getTodayStatsService error', { error: err.message, driverId });
    throw err;
  }
};

export const getWeeklyStatsService = async (driverId) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const rides = await Ride.find({
      driver: driverId,
      status: 'completed',
      completedAt: { $gte: weekAgo }
    });

    const earnings = rides.reduce((sum, ride) => sum + (ride.fare || 0), 0);
    const totalRides = rides.length;
    const distance = rides.reduce((sum, ride) => sum + (ride.distance || 0), 0);

    return {
      success: true,
      stats: {
        earnings,
        rides: totalRides,
        distance: distance.toFixed(1)
      }
    };
  } catch (err) {
    logger.error('getWeeklyStatsService error', { error: err.message, driverId });
    throw err;
  }
};

export const getEarningsHistoryService = async (driverId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const rides = await Ride.find({
      driver: driverId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('rider', 'name')
    .select('pickupLocation dropoffLocation fare completedAt distance');

    const total = await Ride.countDocuments({
      driver: driverId,
      status: 'completed'
    });

    return {
      success: true,
      earnings: rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (err) {
    logger.error('getEarningsHistoryService error', { error: err.message, driverId });
    throw err;
  }
};

export const getRideHistoryService = async (driverId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const rides = await Ride.find({
      driver: driverId,
      status: { $in: ['completed', 'cancelled'] }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('rider', 'name rating');

    const total = await Ride.countDocuments({
      driver: driverId,
      status: { $in: ['completed', 'cancelled'] }
    });

    return {
      success: true,
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (err) {
    logger.error('getRideHistoryService error', { error: err.message, driverId });
    throw err;
  }
};

export const getPerformanceMetricsService = async (driverId) => {
  try {
    const driver = await Driver.findById(driverId);
    
    if (!driver) {
      return { success: false, message: 'Driver not found' };
    }

    const metrics = {
      rating: driver.rating,
      totalRides: driver.totalRides,
      completedRides: driver.completedRides,
      cancelledRides: driver.cancelledRides,
      acceptanceRate: driver.totalRides > 0 ? 
        ((driver.completedRides / driver.totalRides) * 100).toFixed(2) : 100,
      cancellationRate: driver.totalRides > 0 ? 
        ((driver.cancelledRides / driver.totalRides) * 100).toFixed(2) : 0,
      totalEarnings: driver.totalEarnings,
      totalDistance: driver.totalDistance
    };

    return {
      success: true,
      metrics
    };
  } catch (err) {
    logger.error('getPerformanceMetricsService error', { error: err.message, driverId });
    throw err;
  }
};
