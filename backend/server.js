import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import app from "./app.js";
import http from 'http';
import { Server } from 'socket.io';
// import logger from './config/logger.js';
// import { register } from './config/metrics.js';
import { setSocketInstance } from './config/socketHelper.js';

dotenv.config();
connectDB();

// Connect to Redis
(async () => {
  try {
    await connectRedis();
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
  }
})();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET','POST']
  }
});

// Set socket instance for use in services
setSocketInstance(io);

// Expose Prometheus metrics endpoint
// app.get('/metrics', async (req, res) => {
//   try {
//     res.set('Content-Type', register.contentType);
//     res.end(await register.metrics());
//   } catch (error) {
//     res.status(500).end(error);
//   }
// });

io.on('connection', (socket) => {
  // logger.info('Socket connected', { socketId: socket.id });

  socket.on('admin:subscribe', () => {
    socket.join('admin_room');
    // logger.info('Socket joined admin room', { socketId: socket.id });
  });

  // Rider subscribes to personal room for notifications
  socket.on('rider:subscribe', (data) => {
    if (data && data.riderId) {
      socket.join(`rider_${data.riderId}`);
      console.log(`🚴 Rider ${data.riderId} joined room rider_${data.riderId}`);
    } else {
      console.log(`⚠️ Rider tried to subscribe without riderId:`, data);
    }
  });

  // Driver subscribes to receive ride requests
  socket.on('driver:subscribe', (data) => {
    if (data && data.driverId) {
      socket.driverId = data.driverId; // Store driverId on socket
      socket.join('available_drivers'); // Join room for available drivers
      socket.join(`driver_${data.driverId}`); // Join personal driver room
      console.log(`✅ Driver ${data.driverId} subscribed for ride requests`);
    }
  });

  // Driver goes offline
  socket.on('driver:unsubscribe', (data) => {
    if (data && data.driverId) {
      socket.leave('available_drivers');
      socket.leave(`driver_${data.driverId}`);
      console.log(`❌ Driver ${data.driverId} unsubscribed from ride requests`);
    }
  });

  socket.on('subscribe_ride', (data) => {
    if (data && data.rideId) {
      const room = `ride_${data.rideId}`;
      socket.join(room);
      // logger.info('Socket joined ride room', { socketId: socket.id, room });
    }
  });

  socket.on('unsubscribe_ride', (data) => {
    if (data && data.rideId) {
      const room = `ride_${data.rideId}`;
      socket.leave(room);
      // logger.info('Socket left ride room', { socketId: socket.id, room });
    }
  });

  // Driver client can emit location updates; server will forward to subscribers
  socket.on('driver:updateLocation', (data) => {
    try {
      const { rideId, lng, lat } = data || {};
      if (rideId) {
        const room = `ride_${rideId}`;
        io.to(room).emit('driver_location_update', { lng, lat });
        // logger.debug('Driver location update emitted', { room, lng, lat });
      } else {
        // broadcast as fallback
        io.emit('driver_location_update', { lng: data.lng, lat: data.lat });
        // logger.debug('Driver location broadcasted', { lng: data.lng, lat: data.lat });
      }
    } catch (err) {
      // logger.error('Error handling driver location update', { error: err.message });
    }
  });

  socket.on('disconnect', (reason) => {
    // logger.info('Socket disconnected', { socketId: socket.id, reason });
    if (socket.driverId) {
      console.log(`❌ Driver ${socket.driverId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  // logger.info(`RapidRide server started on port ${PORT}`);
  // logger.info(`Metrics available at http://localhost:${PORT}/metrics`);
});

// Export io for use in services
export { io };

// Start scheduled rides worker (BullMQ background processor)
import './jobs/scheduledRideWorker.js';
