import bullpkg from 'bullmq';
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables

// Resolve Worker for CommonJS/ESM interop
const Worker = bullpkg.Worker || bullpkg?.default?.Worker;
import IORedis from 'ioredis';
import { processScheduledRideJob } from '../services/riderService.js';

// Create Redis connection for worker
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

let scheduledRideWorker = null;

if (!Worker) {
  console.warn('⚠️ bullmq Worker constructor not found; scheduled rides worker will not start');
  // Create a lightweight no-op fallback to keep other code paths consistent
  scheduledRideWorker = {
    close: async () => {},
    on: () => {},
  };
} else {
  try {
    scheduledRideWorker = new Worker(
      'scheduled-rides',
      async (job) => {
        const { rideId } = job.data;
        console.log(`🔄 Processing scheduled ride job: ${job.id} for ride: ${rideId}`);
        try {
          const result = await processScheduledRideJob(rideId);
          if (result.success) {
            console.log(`✅ Successfully processed scheduled ride: ${rideId}`);
            return result;
          } else {
            console.log(`⚠️ Scheduled ride processing skipped: ${rideId} - ${result.message}`);
            return result;
          }
        } catch (error) {
          console.error(`❌ Error processing scheduled ride ${rideId}:`, error);
          throw error; // Throw to trigger retry
        }
      },
      {
        connection,
        concurrency: 5,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 }
      }
    );

    // Worker event listeners
    scheduledRideWorker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    scheduledRideWorker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err?.message || err);
    });

    scheduledRideWorker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });

    scheduledRideWorker.on('ready', () => {
      console.log('🚀 Scheduled rides worker is ready and listening for jobs');
    });
  } catch (err) {
    console.error('❌ Failed to initialize scheduled rides worker:', err && err.message);
  }
}

// Graceful shutdown handlers - only for standalone worker process
const _shutdownWorker = async () => {
  console.log('⏸️ Gracefully shutting down scheduled rides worker...');
  if (scheduledRideWorker && typeof scheduledRideWorker.close === 'function') {
    try { await scheduledRideWorker.close(); } catch (e) {}
  }
  try { await connection.quit(); } catch (e) {}
};

// Only set up process handlers if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  process.on('SIGINT', async () => {
    await _shutdownWorker();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await _shutdownWorker();
    process.exit(0);
  });
}

export default scheduledRideWorker;
export { _shutdownWorker };
