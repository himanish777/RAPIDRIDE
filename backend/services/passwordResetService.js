import { sendOTPEmail } from '../config/email.js';
import Rider from '../models/Rider.js';
import Driver from '../models/Driver.js';
import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import logger from '../config/logger.js';

// In-memory OTP storage (since Redis is disabled)
// Format: { email: { otp: '123456', expiry: timestamp } }
const otpStore = new Map();

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Find user by email across all models
 */
const findUserByEmail = async (email) => {
  let user = await Rider.findOne({ email });
  if (user) return { user, role: 'rider', Model: Rider };

  user = await Driver.findOne({ email });
  if (user) return { user, role: 'driver', Model: Driver };

  user = await Admin.findOne({ email });
  if (user) return { user, role: 'admin', Model: Admin };

  return null;
};

/**
 * Send OTP for password reset
 */
const forgotPasswordService = async (email) => {
  try {
    // Find user
    const result = await findUserByEmail(email);
    if (!result) {
      return { success: false, message: 'No account found with this email' };
    }

    const { user, role } = result;

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in memory with 10 min expiry
    const expiry = Date.now() + (10 * 60 * 1000); // 10 minutes
    otpStore.set(email, { otp, expiry });

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name);

    // Log OTP for development (REMOVE IN PRODUCTION)
    logger.info('OTP generated for password reset', { email, otp, role });
    console.log(`\n🔐 OTP for ${email}: ${otp}\n`);

    if (!emailResult.success) {
      logger.error('Failed to send OTP email', { email, error: emailResult.error });
      // Still return success since OTP is stored in Redis
      return { 
        success: true, 
        message: 'OTP generated. Check server console for OTP (email service unavailable)'
      };
    }

    logger.info('OTP sent for password reset', { email, role });

    return {
      success: true,
      message: 'OTP sent to your email'
    };
  } catch (error) {
    logger.error('Error in forgotPasswordService', { error: error.message, email });
    return { success: false, message: 'Server error. Please try again.' };
  }
};

/**
 * Verify OTP
 */
const verifyOTPService = async (email, otp) => {
  try {
    // Get OTP from memory
    const stored = otpStore.get(email);

    if (!stored) {
      return { success: false, message: 'OTP expired. Please request a new one.' };
    }

    // Check if OTP has expired
    if (Date.now() > stored.expiry) {
      otpStore.delete(email);
      return { success: false, message: 'OTP expired. Please request a new one.' };
    }

    if (stored.otp !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Delete OTP from memory
    otpStore.delete(email);

    logger.info('OTP verified successfully', { email });

    return {
      success: true,
      message: 'OTP verified successfully',
      token: resetToken
    };
  } catch (error) {
    logger.error('Error in verifyOTPService', { error: error.message, email });
    return { success: false, message: 'Server error. Please try again.' };
  }
};

/**
 * Reset password and auto-login
 */
const resetPasswordService = async (email, token, newPassword) => {
  try {
    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.email !== email || decoded.purpose !== 'password-reset') {
        return { success: false, message: 'Invalid reset token' };
      }
    } catch (error) {
      return { success: false, message: 'Reset token expired. Please start over.' };
    }

    // Find user
    const result = await findUserByEmail(email);
    if (!result) {
      return { success: false, message: 'User not found' };
    }

    const { user, role, Model } = result;

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Generate auth token for auto-login
    const authToken = jwt.sign(
      { userId: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '1d' }
    );

    logger.info('Password reset successful', { email, role });

    return {
      success: true,
      message: 'Password reset successful',
      token: authToken,
      role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    };
  } catch (error) {
    logger.error('Error in resetPasswordService', { error: error.message, email });
    return { success: false, message: 'Server error. Please try again.' };
  }
};

export {
  forgotPasswordService,
  verifyOTPService,
  resetPasswordService
};
