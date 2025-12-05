import Ride from "../models/Ride.js";
import Rider from "../models/Rider.js";
import logger from '../config/logger.js';
import { metrics } from '../config/metrics.js';
import { emitToAdmin, emitToRide, emitToDrivers } from '../config/socketHelper.js';

// ===== USER PROFILE SERVICES =====
export const getUserProfileService = async (userId) => {
  try {
    const user = await Rider.findById(userId).select('-password');
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return { success: true, user };
  } catch (err) {
    console.error('getUserProfileService error:', err);
    throw err;
  }
};

export const updateUserProfileService = async (userId, updates) => {
  try {
    const user = await Rider.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    return { success: true, user };
  } catch (err) {
    console.error('updateUserProfileService error:', err);
    throw err;
  }
};

// ===== RIDE SERVICES =====
export const requestRideService = async (userId, { pickup, drop, rideType }) => {
  try {
    if (!pickup || !drop) {
      return { success: false, message: 'pickup and drop required' };
    }

    // Check if user already has an active ride
    const existingRide = await Ride.findOne({
      rider: userId,
      status: { $nin: ['completed', 'cancelled'] }
    });

    if (existingRide) {
      return { success: false, message: 'You already have an active ride. Please complete or cancel it first.' };
    }

    const ride = await Ride.create({
      rider: userId,
      pickupLocation: { address: pickup },
      dropoffLocation: { address: drop },
      type: rideType || 'economy',
      status: 'searching'
    });

    // Populate rider info for drivers
    await ride.populate('rider', 'name phone');

    // Track metrics
    metrics.ridesRequestedCounter.inc({ status: 'searching' });
    metrics.activeRidesGauge.inc();

    // Emit real-time event to admin
    emitToAdmin('ride:created', { 
      rideId: ride._id, 
      userId, 
      pickup, 
      drop, 
      rideType: rideType || 'economy',
      status: 'searching'
    });

    // Emit ride request to all available drivers
    emitToDrivers('ride:newRequest', {
      rideId: ride._id,
      rider: {
        id: ride.rider._id,
        name: ride.rider.name,
        phone: ride.rider.phone
      },
      pickup: ride.pickupLocation.address,
      drop: ride.dropoffLocation.address,
      pickupLocation: ride.pickupLocation,
      dropoffLocation: ride.dropoffLocation,
      type: ride.type,
      status: ride.status,
      createdAt: ride.createdAt
    });

    console.log(`🚗 New ride request ${ride._id} sent to available drivers`);
    logger.info('Ride requested', { userId, rideId: ride._id, type: rideType || 'economy' });
    return { success: true, ride };
  } catch (err) {
    logger.error('requestRideService error', { error: err.message, userId });
    throw err;
  }
};

export const getCurrentRideService = async (userId) => {
  try {
    const ride = await Ride.findOne({ 
      rider: userId, 
      status: { $nin: ['completed', 'cancelled'] } 
    })
    .sort({ createdAt: -1 })
    .populate('driver', 'name phone rating vehicle');
    
    return { success: true, ride };
  } catch (err) {
    console.error('getCurrentRideService error:', err);
    throw err;
  }
};

export const getRideDetailsService = async (userId, rideId) => {
  try {
    const ride = await Ride.findById(rideId).populate('driver', 'name phone rating vehicle');
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }
    
    if (String(ride.rider) !== userId) {
      return { success: false, message: 'Forbidden' };
    }
    
    return { success: true, ride };
  } catch (err) {
    console.error('getRideDetailsService error:', err);
    throw err;
  }
};

export const cancelRideService = async (userId, rideId) => {
  try {
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }
    
    if (String(ride.rider) !== userId) {
      return { success: false, message: 'Forbidden' };
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return { success: false, message: 'Cannot cancel this ride' };
    }

    ride.status = 'cancelled';
    
    // Track cancellation metric
    metrics.ridesCancelledCounter.inc({ cancelled_by: 'rider' });
    metrics.activeRidesGauge.dec();
    await ride.save();

    // Emit real-time event to admin and ride room
    emitToAdmin('ride:cancelled', { rideId: ride._id, userId });
    emitToRide(rideId, 'ride:status_changed', { status: 'cancelled', ride });

    return { success: true, ride };
  } catch (err) {
    console.error('cancelRideService error:', err);
    throw err;
  }
};

export const getRideHistoryService = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const items = await Ride.find({ 
      rider: userId, 
      status: { $in: ['completed', 'cancelled'] } 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('driver', 'name rating');

    const total = await Ride.countDocuments({ 
      rider: userId, 
      status: { $in: ['completed', 'cancelled'] } 
    });

    return { success: true, items, total, page };
  } catch (err) {
    console.error('getRideHistoryService error:', err);
    throw err;
  }
};

export const estimateFareService = async ({ pickup, drop, rideType }) => {
  try {
    // TODO: Implement real distance calculation using Google Maps API or similar
    // For now, using simple base fare calculation
    const base = { 
      economy: 120, 
      comfort: 180, 
      premium: 250, 
      shared: 80 
    };
    
    const fareMin = base[rideType] || 120;
    const fareMax = Math.round(fareMin * 1.25);
    
    return { 
      success: true, 
      estimate: `₹${fareMin} - ₹${fareMax}`,
      min: fareMin,
      max: fareMax
    };
  } catch (err) {
    console.error('estimateFareService error:', err);
    throw err;
  }
};

export const scheduleRideService = async (userId, { pickup, drop, rideType, scheduledAt, recurrence }) => {
  try {
    if (!pickup || !drop || !scheduledAt) {
      return { success: false, message: 'Missing required fields' };
    }

    let isRecurring = false;
    let recurringDays = [];

    if (recurrence && recurrence !== 'once') {
      isRecurring = true;
      if (recurrence === 'daily') {
        recurringDays = [0, 1, 2, 3, 4, 5, 6]; // All days
      } else if (recurrence === 'weekdays') {
        recurringDays = [1, 2, 3, 4, 5]; // Mon-Fri
      } else if (recurrence === 'weekends') {
        recurringDays = [0, 6]; // Sat-Sun
      }
    }

    const ride = await Ride.create({
      rider: userId,
      pickupLocation: { address: pickup },
      dropoffLocation: { address: drop },
      type: rideType || 'economy',
      scheduledAt: new Date(scheduledAt),
      status: 'scheduled',
      isRecurring,
      recurringDays
    });

    return { success: true, ride };
  } catch (err) {
    console.error('scheduleRideService error:', err);
    throw err;
  }
};

export const getScheduledRidesService = async (userId) => {
  try {
    const rides = await Ride.find({ 
      rider: userId, 
      scheduledAt: { $ne: null },
      status: { $nin: ['completed', 'cancelled'] }
    })
    .sort({ scheduledAt: 1 });
    
    return { success: true, rides };
  } catch (err) {
    console.error('getScheduledRidesService error:', err);
    throw err;
  }
};

// ===== REWARDS & COUPONS SERVICES =====
export const getRewardPointsService = async (userId) => {
  try {
    // TODO: Implement real rewards system with database
    // For now, returning static data
    const completedRides = await Ride.countDocuments({ 
      rider: userId, 
      status: 'completed' 
    });
    
    // Simple calculation: 10 points per completed ride
    const points = completedRides * 10;
    
    return { success: true, points, coupons: [] };
  } catch (err) {
    console.error('getRewardPointsService error:', err);
    throw err;
  }
};

export const applyCouponService = async (userId, code) => {
  try {
    if (!code) {
      return { success: false, message: 'Coupon code required' };
    }
    
    // TODO: Implement real coupon validation and application
    // For now, returning success
    return { success: true, applied: true, code, discount: 0 };
  } catch (err) {
    console.error('applyCouponService error:', err);
    throw err;
  }
};

// ===== NOTIFICATION SERVICES =====
export const getNotificationsService = async (userId) => {
  try {
    // TODO: Implement real notification system with database
    // For now, returning empty array
    return { success: true, notifications: [] };
  } catch (err) {
    console.error('getNotificationsService error:', err);
    throw err;
  }
};

export const markNotificationReadService = async (userId, notificationId) => {
  try {
    // TODO: Implement notification read status update
    return { success: true };
  } catch (err) {
    console.error('markNotificationReadService error:', err);
    throw err;
  }
};

// ===== SUPPORT SERVICES =====
export const submitSupportRequestService = async (userId, supportData) => {
  try {
    // TODO: Save support ticket to database
    const ticketId = 'TICKET-' + Date.now();
    
    console.log('Support request from user:', userId, supportData);
    
    return { success: true, ticketId };
  } catch (err) {
    console.error('submitSupportRequestService error:', err);
    throw err;
  }
};

// ===== EMERGENCY SERVICES =====
export const triggerSOSService = async (userId, location) => {
  try {
    // TODO: Implement real emergency alert system
    // - Notify emergency contacts
    // - Alert nearby authorities
    // - Log emergency in database
    
    console.log('🆘 SOS ALERT from user:', userId, 'Location:', location);
    
    return { success: true, sos: true, message: 'Emergency services notified' };
  } catch (err) {
    console.error('triggerSOSService error:', err);
    throw err;
  }
};

// ===== ANALYTICS SERVICES =====
export const getRideAnalyticsService = async (userId) => {
  try {
    // Get rides from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const rides = await Ride.find({
      rider: userId,
      status: 'completed',
      createdAt: { $gte: sevenDaysAgo }
    });
    
    // Group by day
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const rideCounts = new Array(7).fill(0);
    
    rides.forEach(ride => {
      const dayIndex = new Date(ride.createdAt).getDay();
      // Convert Sunday (0) to index 6, Monday (1) to index 0, etc.
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      rideCounts[adjustedIndex]++;
    });
    
    const totalRides = rides.length;
    
    return { 
      success: true, 
      totalRides, 
      series: { labels, rides: rideCounts } 
    };
  } catch (err) {
    console.error('getRideAnalyticsService error:', err);
    throw err;
  }
};

// ===== INVOICE SERVICES =====
export const getInvoiceService = async (userId, rideId) => {
  try {
    const ride = await Ride.findById(rideId).populate('driver', 'name');
    
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }
    
    if (String(ride.rider) !== userId) {
      return { success: false, message: 'Forbidden' };
    }
    
    // TODO: Generate actual PDF invoice
    // For now, return invoice URL
    return { 
      success: true, 
      invoiceUrl: `/invoices/${rideId}.pdf`,
      ride 
    };
  } catch (err) {
    console.error('getInvoiceService error:', err);
    throw err;
  }
};
