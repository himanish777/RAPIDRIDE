import Rider from "../models/Rider.js";
import Driver from "../models/Driver.js";
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import { createToken } from "../config/jwt.js";
import logger from '../config/logger.js';
import { metrics } from '../config/metrics.js';
import { emitToAdmin } from '../config/socketHelper.js';

export const signupService = async ({ name, email, phone, password, role }) => {
  try {
    logger.info('Signup attempt', { email, role });
    
    const Model = role === 'driver' ? Driver : role === 'admin' ? Admin : Rider;
    
    // Check if email already exists
    const emailExists = await Model.findOne({ email });
    if (emailExists) {
      logger.warn('Signup failed - email already exists', { email });
      return { success: false, message: "Email already exists" };
    }
    
    // Check if phone already exists (for all models)
    if (phone) {
      const phoneExistsInRider = await Rider.findOne({ phone });
      const phoneExistsInDriver = await Driver.findOne({ phone });
      const phoneExistsInAdmin = await Admin.findOne({ phone });
      
      if (phoneExistsInRider || phoneExistsInDriver || phoneExistsInAdmin) {
        logger.warn('Signup failed - phone already exists', { phone });
        return { success: false, message: "Phone number already exists" };
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await Model.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role 
    });

    // Track registration metric
    metrics.userRegistrationsCounter.inc({ role: role || 'rider' });

    // Emit real-time event to admin
    emitToAdmin('user:registered', {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    logger.info('User created successfully', { userId: user._id, email, role: user.role });
    return { success: true, user: { name: user.name, email: user.email, role: user.role } };
  } catch (error) {
    logger.error('Signup service error', { error: error.message, email });
    return { success: false, message: "Signup failed: " + error.message };
  }
};

export const loginService = async ({ email, password }) => {
  try {
    logger.info('Login attempt', { email });
    
    // Check all three collections to find the user
    let user = null;
    let userRole = null;
    
    // Check Rider collection
    user = await Rider.findOne({ email });
    if (user) {
      userRole = 'rider';
    }
    
    // Check Driver collection if not found in Rider
    if (!user) {
      user = await Driver.findOne({ email });
      if (user) {
        userRole = 'driver';
      }
    }
    
    // Check Admin collection if not found in Driver
    if (!user) {
      user = await Admin.findOne({ email });
      if (user) {
        userRole = 'admin';
      }
    }
    
    if (!user) {
      logger.warn('Login failed - user not found', { email });
      metrics.loginAttemptsCounter.inc({ status: 'user_not_found' });
      return { success: false, message: "User not found" };
    }

    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      logger.warn('Login failed - wrong password', { email });
      metrics.loginAttemptsCounter.inc({ status: 'wrong_password' });
      return { success: false, message: "Wrong password" };
    }

    const token = createToken({
      userId: user._id,
      role: userRole
    });

    // Track successful login
    metrics.loginAttemptsCounter.inc({ status: 'success' });

    logger.info('Login successful', { userId: user._id, email, role: userRole });
    return {
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: userRole
      }
    };
  } catch (error) {
    logger.error('Login service error', { error: error.message, email });
    return { success: false, message: "Login failed: " + error.message };
  }
};