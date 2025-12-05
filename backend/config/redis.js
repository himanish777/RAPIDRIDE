// REDIS DISABLED - All functionality commented out
// import { createClient } from 'redis';
// import logger from './logger.js';

// // Create Redis client
// const redisClient = createClient({
//   url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
//   socket: {
//     reconnectStrategy: (retries) => {
//       if (retries > 10) {
//         // logger.error('Redis: Too many reconnection attempts, giving up');
//         return new Error('Redis reconnection failed');
//       }
//       // Exponential backoff: 50ms, 100ms, 200ms, etc.
//       const delay = Math.min(retries * 50, 3000);
//       // logger.warn(`Redis: Reconnecting in ${delay}ms... (attempt ${retries})`);
//       return delay;
//     }
//   }
// });

// // Error handling
// redisClient.on('error', (err) => {
//   // logger.error('Redis Client Error:', { error: err.message });
// });

// redisClient.on('connect', () => {
//   // logger.info('Redis Client Connected');
// });

// redisClient.on('ready', () => {
//   // logger.info('Redis Client Ready');
// });

// redisClient.on('reconnecting', () => {
//   // logger.warn('Redis Client Reconnecting...');
// });

// Connect to Redis - DISABLED
export const connectRedis = async () => {
  // Redis disabled - no connection needed
  return Promise.resolve();
};

// // Graceful shutdown
// process.on('SIGINT', async () => {
//   if (redisClient.isOpen) {
//     await redisClient.quit();
//     // logger.info('Redis connection closed');
//   }
// });

// Helper functions - ALL DISABLED, return empty/null values
export const redisHelpers = {
  async get(key) { return null; },
  async set(key, value, expireSeconds = 3600) { return false; },
  async del(key) { return false; },
  async delPattern(pattern) { return false; },
  async zAdd(key, score, member) { return false; },
  async zRange(key, start, stop) { return []; },
  async zRangeByLex(key, min, max, limit = 10) { return []; },
  async incr(key) { return 0; },
  async expire(key, seconds) { return false; }
};

// // Helper functions
// export const redisHelpers = {
//   // Get cached data
//   async get(key) {
//     try {
//       if (!redisClient.isOpen) return null;
//       const data = await redisClient.get(key);
//       return data ? JSON.parse(data) : null;
//     } catch (error) {
//       // logger.error('Redis GET error:', { key, error: error.message });
//       return null;
//     }
//   },

//   // Set cached data with expiration (in seconds)
//   async set(key, value, expireSeconds = 3600) {
//     try {
//       if (!redisClient.isOpen) return false;
//       await redisClient.setEx(key, expireSeconds, JSON.stringify(value));
//       return true;
//     } catch (error) {
//       // logger.error('Redis SET error:', { key, error: error.message });
//       return false;
//     }
//   },

//   // Delete cached data
//   async del(key) {
//     try {
//       if (!redisClient.isOpen) return false;
//       await redisClient.del(key);
//       return true;
//     } catch (error) {
//       logger.error('Redis DEL error:', { key, error: error.message });
//       return false;
//     }
//   },

//   // Delete multiple keys matching pattern
//   async delPattern(pattern) {
//     try {
//       if (!redisClient.isOpen) return false;
//       const keys = await redisClient.keys(pattern);
//       if (keys.length > 0) {
//         await redisClient.del(keys);
//       }
//       return true;
//     } catch (error) {
//       logger.error('Redis DEL pattern error:', { pattern, error: error.message });
//       return false;
//     }
//   },

//   // Add to sorted set (for autocomplete)
//   async zAdd(key, score, member) {
//     try {
//       if (!redisClient.isOpen) return false;
//       await redisClient.zAdd(key, { score, value: member });
//       return true;
//     } catch (error) {
//       logger.error('Redis ZADD error:', { key, error: error.message });
//       return false;
//     }
//   },

//   // Get range from sorted set
//   async zRange(key, start, stop) {
//     try {
//       if (!redisClient.isOpen) return [];
//       return await redisClient.zRange(key, start, stop);
//     } catch (error) {
//       logger.error('Redis ZRANGE error:', { key, error: error.message });
//       return [];
//     }
//   },

//   // Search in sorted set (for autocomplete)
//   async zRangeByLex(key, min, max, limit = 10) {
//     try {
//       if (!redisClient.isOpen) return [];
//       return await redisClient.zRangeByLex(key, min, max, { LIMIT: { offset: 0, count: limit } });
//     } catch (error) {
//       logger.error('Redis ZRANGEBYLEX error:', { key, error: error.message });
//       return [];
//     }
//   },

//   // Increment counter
//   async incr(key) {
//     try {
//       if (!redisClient.isOpen) return 0;
//       return await redisClient.incr(key);
//     } catch (error) {
//       logger.error('Redis INCR error:', { key, error: error.message });
//       return 0;
//     }
//   },

//   // Set expiration on existing key
//   async expire(key, seconds) {
//     try {
//       if (!redisClient.isOpen) return false;
//       await redisClient.expire(key, seconds);
//       return true;
//     } catch (error) {
//       logger.error('Redis EXPIRE error:', { key, error: error.message });
//       return false;
//     }
//   }
// };

// Dummy exports for compatibility
export const redisClient = null;
export default null;
