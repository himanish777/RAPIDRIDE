import mongoose from "mongoose";

const RiderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, default: "rider" },
  
  // Rider-specific fields
  profilePhoto: String,
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  totalRides: { type: Number, default: 0 },
  
  // Favorite locations
  favoriteLocations: [{
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  }],
  
  // Payment methods
  paymentMethods: [{
    type: { type: String, enum: ['card', 'upi', 'wallet'] },
    isDefault: { type: Boolean, default: false },
    details: mongoose.Schema.Types.Mixed
  }],
  
  // Account status
  isBlocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date
}, {
  timestamps: true  // This adds createdAt and updatedAt fields automatically
});

// Index for quick lookups
RiderSchema.index({ email: 1 });
RiderSchema.index({ phone: 1 });

export default mongoose.model("Rider", RiderSchema);
