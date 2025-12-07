import Rider from '../models/Rider.js';
import Driver from '../models/Driver.js';
import Ride from '../models/Ride.js';
import logger from '../config/logger.js';

// Get dashboard overview statistics
const getDashboardOverviewService = async () => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalRiders,
      totalDrivers,
      totalRides,
      todayRides,
      weekRides,
      activeRides,
      completedRides,
      cancelledRides,
      totalRevenue,
    ] = await Promise.all([
      Rider.countDocuments(),
      Driver.countDocuments(),
      Ride.countDocuments(),
      Ride.countDocuments({ createdAt: { $gte: todayStart } }),
      Ride.countDocuments({ createdAt: { $gte: weekStart } }),
      Ride.countDocuments({ status: { $in: ['searching', 'assigned', 'arriving', 'on_trip'] } }),
      Ride.countDocuments({ status: 'completed' }),
      Ride.countDocuments({ status: 'cancelled' }),
      Ride.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$fare' } } },
      ]),
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    return {
      users: { total: totalRiders + totalDrivers, riders: totalRiders, drivers: totalDrivers },
      rides: {
        total: totalRides,
        today: todayRides,
        week: weekRides,
        active: activeRides,
        completed: completedRides,
        cancelled: cancelledRides,
      },
      revenue: revenue,
    };
  } catch (error) {
    logger.error('Error in getDashboardOverviewService', { error: error.message });
    throw error;
  }
};

// Get all users with pagination
const getAllUsersService = async (page = 1, limit = 50, role = null, includeDeleted = false) => {
  try {
    const query = {};
    
    // By default, exclude deleted users
    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }
    
    const skip = (page - 1) * limit;
    
    const Model = role === 'driver' ? Driver : role === 'rider' ? Rider : null;
    
    let users, total;
    if (Model) {
      [users, total] = await Promise.all([
        Model.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Model.countDocuments(query),
      ]);
    } else {
      // Get both riders and drivers
      const [riders, drivers, riderCount, driverCount] = await Promise.all([
        Rider.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
        Driver.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
        Rider.countDocuments(query),
        Driver.countDocuments(query),
      ]);
      users = [...riders, ...drivers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(skip, skip + limit);
      total = riderCount + driverCount;
    }

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error in getAllUsersService', { error: error.message });
    throw error;
  }
};

// Get all rides with pagination and filters
const getAllRidesService = async (page = 1, limit = 50, status = null, startDate = null, endDate = null) => {
  try {
    const query = {};
    if (status) query.status = status;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      Ride.find(query)
        .populate('rider', 'name email phone')
        .populate('driver', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ride.countDocuments(query),
    ]);

    return {
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error in getAllRidesService', { error: error.message });
    throw error;
  }
};

// Get ride details by ID
const getRideDetailsService = async (rideId) => {
  try {
    const ride = await Ride.findById(rideId)
      .populate('rider', 'name email phone')
      .populate('driver', 'name email phone')
      .lean();

    if (!ride) {
      throw new Error('Ride not found');
    }

    return ride;
  } catch (error) {
    logger.error('Error in getRideDetailsService', { error: error.message, rideId });
    throw error;
  }
};

// Get user details by ID
const getUserDetailsService = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password').lean();

    if (!user) {
      throw new Error('User not found');
    }

    // Get user's ride statistics
    const rideStats = await Ride.aggregate([
      { $match: { rider: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalFare: { $sum: '$fare' },
        },
      },
    ]);

    return {
      user,
      rideStats,
    };
  } catch (error) {
    logger.error('Error in getUserDetailsService', { error: error.message, userId });
    throw error;
  }
};

// Get revenue analytics
const getRevenueAnalyticsService = async (days = 30) => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const revenueByDay = await Ride.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          revenue: { $sum: '$fare' },
          rides: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const revenueByRideType = await Ride.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          revenue: { $sum: '$fare' },
          rides: { $sum: 1 },
          avgFare: { $avg: '$fare' },
        },
      },
    ]);

    const totalRevenue = revenueByDay.reduce((sum, day) => sum + day.revenue, 0);
    const totalRides = revenueByDay.reduce((sum, day) => sum + day.rides, 0);

    return {
      totalRevenue,
      totalRides,
      avgFare: totalRides > 0 ? totalRevenue / totalRides : 0,
      revenueByDay,
      revenueByRideType,
    };
  } catch (error) {
    logger.error('Error in getRevenueAnalyticsService', { error: error.message });
    throw error;
  }
};

// Get ride analytics
const getRideAnalyticsService = async (days = 7) => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ridesByStatus = await Ride.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const ridesByType = await Ride.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const hourlyDistribution = await Ride.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    const avgRideDistance = await Ride.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          avgDistance: { $avg: '$distanceKm' },
          totalDistance: { $sum: '$distanceKm' },
        },
      },
    ]);

    return {
      ridesByStatus,
      ridesByType,
      hourlyDistribution,
      avgDistance: avgRideDistance.length > 0 ? avgRideDistance[0].avgDistance : 0,
      totalDistance: avgRideDistance.length > 0 ? avgRideDistance[0].totalDistance : 0,
    };
  } catch (error) {
    logger.error('Error in getRideAnalyticsService', { error: error.message });
    throw error;
  }
};

// Get system logs
const getSystemLogsService = async (page = 1, limit = 100, level = null) => {
  try {
    // This is a placeholder - in production, you'd read from log files or a logging service
    // For now, return mock data structure
    return {
      logs: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0,
      },
      message: 'Log reading from files will be implemented based on winston file transports',
    };
  } catch (error) {
    logger.error('Error in getSystemLogsService', { error: error.message });
    throw error;
  }
};

// Block/unblock user
const toggleUserStatusService = async (userId, isBlocked) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User status toggled', { userId, isBlocked });
    return user;
  } catch (error) {
    logger.error('Error in toggleUserStatusService', { error: error.message, userId });
    throw error;
  }
};

// Soft delete user
const deleteUserService = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isDeleted: true,
        deletedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User soft deleted', { userId });
    return { success: true, user, message: 'User account deleted successfully' };
  } catch (error) {
    logger.error('Error in deleteUserService', { error: error.message, userId });
    throw error;
  }
};

// Restore deleted user
const restoreUserService = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isDeleted: false,
        deletedAt: null
      },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User restored', { userId });
    return { success: true, user, message: 'User account restored successfully' };
  } catch (error) {
    logger.error('Error in restoreUserService', { error: error.message, userId });
    throw error;
  }
};

// Get popular routes
const getPopularRoutesService = async (limit = 10) => {
  try {
    const popularRoutes = await Ride.aggregate([
      {
        $match: { status: 'completed' },
      },
      {
        $group: {
          _id: {
            pickup: '$pickupLocation.address',
            dropoff: '$dropoffLocation.address',
          },
          count: { $sum: 1 },
          avgFare: { $avg: '$fare' },
          totalRevenue: { $sum: '$fare' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    return popularRoutes;
  } catch (error) {
    logger.error('Error in getPopularRoutesService', { error: error.message });
    throw error;
  }
};

export {
  getDashboardOverviewService,
  getAllUsersService,
  getAllRidesService,
  getRideDetailsService,
  getUserDetailsService,
  getRevenueAnalyticsService,
  getRideAnalyticsService,
  getSystemLogsService,
  toggleUserStatusService,
  deleteUserService,
  restoreUserService,
  getPopularRoutesService,
};

// Get analytics service (stub for monitoring dashboard)
export const getAnalyticsService = async (period = '7d') => {
  try {
    // Return empty analytics for now
    return {
      period,
      revenue: { total: 0, data: [] },
      rides: { total: 0, data: [] },
      users: { total: 0, data: [] }
    };
  } catch (error) {
    logger.error('getAnalyticsService error', { error: error.message });
    throw error;
  }
};
