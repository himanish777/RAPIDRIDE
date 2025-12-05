// Socket Helper - Provides access to io instance without circular dependencies
let ioInstance = null;

export const setSocketInstance = (io) => {
  ioInstance = io;
};

export const getSocketInstance = () => {
  return ioInstance;
};

// Emit events to admin room
export const emitToAdmin = (event, data) => {
  if (ioInstance) {
    ioInstance.to('admin_room').emit(event, data);
  }
};

// Emit events to available drivers
export const emitToDrivers = (event, data) => {
  if (ioInstance) {
    ioInstance.to('available_drivers').emit(event, data);
  }
};

// Emit events to specific ride room
export const emitToRide = (rideId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`ride_${rideId}`).emit(event, data);
  }
};

// Emit events to specific rider
export const emitToRider = (riderId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`rider_${riderId}`).emit(event, data);
  }
};

// Broadcast to all connected clients
export const broadcastEvent = (event, data) => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
};
