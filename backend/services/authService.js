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

export const loginService = async ({ email, password, role }) => {
  try {
    logger.info('Login attempt', { email, role });
    
    const Model = role === 'driver' ? Driver : role === 'admin' ? Admin : Rider;
    const user = await Model.findOne({ email });
    
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

    if (role !== user.role) {
      logger.warn('Login failed - role mismatch', { email, expectedRole: role, actualRole: user.role });
      metrics.loginAttemptsCounter.inc({ status: 'role_mismatch' });
      return { success: false, message: "Incorrect role selected" };
    }

    const token = createToken({
      userId: user._id,
      role: user.role
    });

    // Track successful login
    metrics.loginAttemptsCounter.inc({ status: 'success' });

    logger.info('Login successful', { userId: user._id, email, role: user.role });
    return {
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    logger.error('Login service error', { error: error.message, email });
    return { success: false, message: "Login failed: " + error.message };
  }
};