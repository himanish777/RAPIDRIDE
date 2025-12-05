import pkg from 'bullmq';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables

// Handle CommonJS/ESM interop: bullmq may export as default or named exports
const Queue = pkg.Queue || pkg?.default?.Queue;
const QueueScheduler = pkg.QueueScheduler || pkg?.default?.QueueScheduler;
import IORedis from 'ioredis';

// Create Redis connection for BullMQ
console.log('🔍 BullMQ Redis URL:', process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

connection.on('error', (err) => {
  console.error('BullMQ Redis connection error:', err.message);
});

connection.on('connect', () => {
  console.log('✅ BullMQ Redis connected');
});

// Create queue for scheduled rides
export const scheduledRidesQueue = new Queue('scheduled-rides', { connection });

// Create queue scheduler to handle delayed jobs if available
let _scheduledRidesScheduler = null;
try {
  if (QueueScheduler) {
    _scheduledRidesScheduler = new QueueScheduler('scheduled-rides', { connection });
    console.log('⏱️ QueueScheduler initialized for scheduled-rides');
  } else {
    console.warn('⚠️ QueueScheduler is not available in bullmq import; delayed job management may be limited');
  }
} catch (err) {
  console.warn('⚠️ Failed to initialize QueueScheduler:', err && err.message);
}

export const scheduledRidesScheduler = _scheduledRidesScheduler;

// Helper to get queue (for easy import)
export const getQueue = () => scheduledRidesQueue;

// Helper to generate consistent job ID
export const getJobId = (rideId) => `scheduled_ride_${rideId}`;

console.log('📦 BullMQ queue initialized: scheduled-rides');
