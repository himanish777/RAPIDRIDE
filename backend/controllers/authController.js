import { signupService, loginService } from "../services/authService.js";
import logger from '../config/logger.js';
import { 
  forgotPasswordService, 
  verifyOTPService, 
  resetPasswordService 
} from '../services/passwordResetService.js';

export const signup = async (req, res) => {
  try {

    if (req.body.role === "admin") {
  return res.status(403).json({ message: "Admin accounts cannot be created through signup" });
}
    logger.info('Signup request received', { email: req.body.email, role: req.body.role });
    const result = await signupService(req.body);
    logger.info('Signup response sent', { success: result.success, email: req.body.email });

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Signup error', { error: error.message, stack: error.stack });
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + error.message 
    });
  }
};

export const login = async (req, res) => {
  try {
    logger.info('Login request received', { email: req.body.email });
    const result = await loginService(req.body);
    logger.info('Login response sent', { success: result.success, email: req.body.email });
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(401).json(result);
    }
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + error.message 
    });
  }
};

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    logger.info('Forgot password request', { email });
    const result = await forgotPasswordService(email);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('Forgot password error', { error: error.message });
    return res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    logger.info('Verify OTP request', { email });
    const result = await verifyOTPService(email, otp);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('Verify OTP error', { error: error.message });
    return res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, token, and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    logger.info('Reset password request', { email });
    const result = await resetPasswordService(email, token, newPassword);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('Reset password error', { error: error.message });
    return res.status(500).json({ 
      success: false, 
      message: 'Server error: ' + error.message 
    });
  }
};