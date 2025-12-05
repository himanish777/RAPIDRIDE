import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  role: { type: String, default: "driver" },
  
  // Vehicle Information
  vehicle: {
    type: {
      type: String,
      enum: ['sedan', 'suv', 'hatchback', 'auto', 'bike'],
      required: function() { return this.vehicleSetupComplete; }
    },
    make: {
      type: String,
      required: function() { return this.vehicleSetupComplete; }
    },
    model: {
      type: String,
      required: function() { return this.vehicleSetupComplete; }
    },
    number: {
      type: String,
      uppercase: true,
      unique: true,
      sparse: true,
      required: function() { return this.vehicleSetupComplete; }
    },
    color: {
      type: String,
      required: function() { return this.vehicleSetupComplete; }
    },
    year: {
      type: Number,
      required: function() { return this.vehicleSetupComplete; }
    }
  },
  
  // License and Documents
  license: {
    number: {
      type: String,
      uppercase: true,
      required: function() { return this.vehicleSetupComplete; }
    },
    expiryDate: Date,
    verified: { type: Boolean, default: false }
  },
  
  insurance: {
    policyNumber: {
      type: String,
      required: function() { return this.vehicleSetupComplete; }
    },
    expiryDate: Date,
    verified: { type: Boolean, default: false }
  },
  
  // Driver Status
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  vehicleSetupComplete: { type: Boolean, default: false },
  documentsVerified: { type: Boolean, default: false },
  
  // Statistics
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  totalRides: { type: Number, default: 0 },
  completedRides: { type: Number, default: 0 },
  cancelledRides: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 }, // in km
  
  // Current Location (for matching with riders)
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  
  // Banking Information (for payouts)
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  
  // Account Status
  isBlocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  
  // Additional Info
  profilePhoto: String,
  languages: [String],
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  }
}, {
  timestamps: true
});

// Index for geospatial queries (finding nearby drivers)
DriverSchema.index({ currentLocation: '2dsphere' });

// Index for quick lookups (email and vehicle.number already indexed via unique: true)
DriverSchema.index({ 'license.number': 1 });
DriverSchema.index({ isOnline: 1, isAvailable: 1 });

// Virtual for acceptance rate
DriverSchema.virtual('acceptanceRate').get(function() {
  if (this.totalRides === 0) return 100;
  return ((this.completedRides / this.totalRides) * 100).toFixed(2);
});

// Virtual for cancellation rate
DriverSchema.virtual('cancellationRate').get(function() {
  if (this.totalRides === 0) return 0;
  return ((this.cancelledRides / this.totalRides) * 100).toFixed(2);
});

export default mongoose.model("Driver", DriverSchema);
