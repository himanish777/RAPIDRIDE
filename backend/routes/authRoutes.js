import express from "express";
import { 
  signup, 
  login, 
  forgotPassword, 
  verifyOTP, 
  resetPassword 
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import Rider from "../models/Rider.js";
import Driver from "../models/Driver.js";
import Admin from "../models/Admin.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const Model = req.user.role === 'driver' ? Driver : req.user.role === 'admin' ? Admin : Rider;
    const user = await Model.findById(req.user.userId).select('-password'); 
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.json({ 
      success: true, 
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

router.get("/protected", authMiddleware, (req, res) => {
  res.json({ message: "Protected route accessed", user: req.user });
});

export default router;