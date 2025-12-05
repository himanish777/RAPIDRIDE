import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, default: "admin" },
  
  // Admin-specific fields
  profilePhoto: String,
  permissions: {
    manageUsers: { type: Boolean, default: true },
    manageRides: { type: Boolean, default: true },
    viewReports: { type: Boolean, default: true },
    systemSettings: { type: Boolean, default: true }
  },
  
  // Account status
  isActive: { type: Boolean, default: true },
  lastLogin: Date
}, {
  timestamps: true
});

// Index for quick lookups (email already indexed via unique: true)

export default mongoose.model("Admin", AdminSchema);
