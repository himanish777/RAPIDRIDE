import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
  address: String,
  lat: Number,
  lng: Number
}, { _id: false });

const RideSchema = new mongoose.Schema({
  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  pickupLocation: { type: LocationSchema, required: true },
  dropoffLocation: { type: LocationSchema, required: true },
  type: { type: String, enum: ['economy','comfort','premium','shared'], default: 'economy' },
  fare: { type: Number, default: 0 },
  distanceKm: { type: Number, default: 0 },
  status: { type: String, enum: ['searching','assigned','arriving','waiting','on_trip','completed','cancelled','scheduled'], default: 'searching' },
  scheduledAt: { type: Date, default: null },
  isRecurring: { type: Boolean, default: false },
  recurringDays: [{ type: Number }],
  acceptedAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Ride', RideSchema);