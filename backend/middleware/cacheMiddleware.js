// import { redisHelpers } from '../config/redis.js';
// import logger from '../config/logger.js';

/**
 * Redis caching middleware - DISABLED
 * Caches GET requests based on URL and query parameters
 */
export const cacheMiddleware = (expireSeconds = 300) => {
  return async (req, res, next) => {
    // Redis caching disabled - pass through
    next();
  };
};

// export const cacheMiddleware = (expireSeconds = 300) => {
//   return async (req, res, next) => {
//     // Only cache GET requests
//     if (req.method !== 'GET') {
//       return next();
//     }

//     try {
//       // Create cache key from URL and query params
//       const cacheKey = `cache:${req.originalUrl || req.url}`;
//       
//       // Try to get cached data
//       const cachedData = await redisHelpers.get(cacheKey);
//       
//       if (cachedData) {
//         logger.debug('Cache HIT', { key: cacheKey });
//         return res.json(cachedData);
//       }

//       logger.debug('Cache MISS', { key: cacheKey });

//       // Store original json method
//       const originalJson = res.json.bind(res);

//       // Override json method to cache response
//       res.json = function(data) {
//         // Cache the response
//         redisHelpers.set(cacheKey, data, expireSeconds).catch(err => {
//           logger.error('Failed to cache response:', { key: cacheKey, error: err.message });
//         });

//         // Send response
//         return originalJson(data);
//       };

//       next();
//     } catch (error) {
//       logger.error('Cache middleware error:', { error: error.message });
//       next();
//     }
//   };
// };

/**
 * Clear cache for specific patterns
 */
export const clearCache = async (pattern = '*') => {
  try {
    await redisHelpers.delPattern(`cache:${pattern}`);
    logger.info('Cache cleared', { pattern });
    return true;
  } catch (error) {
    logger.error('Clear cache error:', { pattern, error: error.message });
    return false;
  }
};

/**
 * Rate limiting middleware using Redis
 */
export const rateLimiter = (maxRequests = 100, windowSeconds = 60) => {
  return async (req, res, next) => {
    try {
      // Use IP address or user ID as identifier
      const identifier = req.user?.userId || req.ip || 'unknown';
      const key = `ratelimit:${identifier}`;

      // Increment counter
      const requests = await redisHelpers.incr(key);

      // Set expiration on first request
      if (requests === 1) {
        await redisHelpers.expire(key, windowSeconds);
      }

      // Check if limit exceeded
      if (requests > maxRequests) {
        logger.warn('Rate limit exceeded', { identifier, requests });
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.'
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests));

      next();
    } catch (error) {
      logger.error('Rate limiter error:', { error: error.message });
      next(); // Continue without rate limiting on error
    }
  };
};

/**
 * Session storage middleware using Redis
 */
export const sessionCache = {
  // Store session data
  async set(sessionId, data, expireSeconds = 86400) {
    const key = `session:${sessionId}`;
    return await redisHelpers.set(key, data, expireSeconds);
  },

  // Get session data
  async get(sessionId) {
    const key = `session:${sessionId}`;
    return await redisHelpers.get(key);
  },

  // Delete session
  async del(sessionId) {
    const key = `session:${sessionId}`;
    return await redisHelpers.del(key);
  }
};
