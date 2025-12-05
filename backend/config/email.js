import nodemailer from 'nodemailer';
import logger from './logger.js';

let transporter = null;

// Create transporter lazily (only when needed)
const getTransporter = () => {
  if (!transporter) {
    const emailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    };
    
    transporter = nodemailer.createTransport(emailConfig);
    
    // Verify transporter configuration (async)
    transporter.verify((error, success) => {
      if (error) {
        logger.error('Email transporter verification failed', { error: error.message });
      } else {
        logger.info('Email service is ready to send messages');
      }
    });
  }
  return transporter;
};

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @param {string} options.from - Sender email (optional, defaults to EMAIL_USER)
 * @returns {Promise<Object>} - Email send result
 */
const sendEmail = async ({ to, subject, text, html, from }) => {
  try {
    const mailOptions = {
      from: from || `"RapidRide" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text
    };

    const info = await getTransporter().sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to,
      subject
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    logger.error('Failed to send email', {
      error: error.message,
      to,
      subject
    });

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send ride confirmation email to rider
 */
const sendRideConfirmationEmail = async (riderEmail, rideDetails) => {
  const { rideId, driverName, vehicleName, vehicleNumber, pickupLocation, dropLocation, estimatedFare } = rideDetails;
  
  const subject = 'Ride Confirmed - RapidRide';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">🚗 Your Ride is Confirmed!</h2>
      <p>Hi there,</p>
      <p>Your ride has been confirmed. Here are the details:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ride ID:</strong> ${rideId}</p>
        <p><strong>Driver:</strong> ${driverName}</p>
        <p><strong>Vehicle:</strong> ${vehicleName} (${vehicleNumber})</p>
        <p><strong>Pickup:</strong> ${pickupLocation}</p>
        <p><strong>Drop:</strong> ${dropLocation}</p>
        <p><strong>Estimated Fare:</strong> ₹${estimatedFare}</p>
      </div>
      
      <p>Your driver is on the way! Track your ride in real-time on the app.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: riderEmail, subject, html });
};

/**
 * Send ride assignment notification to driver
 */
const sendRideAssignmentEmail = async (driverEmail, rideDetails) => {
  const { rideId, riderName, pickupLocation, dropLocation, estimatedFare } = rideDetails;
  
  const subject = 'New Ride Assignment - RapidRide';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2196F3;">🚙 New Ride Assignment</h2>
      <p>Hello Driver,</p>
      <p>You have been assigned a new ride:</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Ride ID:</strong> ${rideId}</p>
        <p><strong>Rider:</strong> ${riderName}</p>
        <p><strong>Pickup:</strong> ${pickupLocation}</p>
        <p><strong>Drop:</strong> ${dropLocation}</p>
        <p><strong>Estimated Fare:</strong> ₹${estimatedFare}</p>
      </div>
      
      <p>Please navigate to the pickup location promptly.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: driverEmail, subject, html });
};

/**
 * Send ride completion email with receipt
 */
const sendRideCompletionEmail = async (riderEmail, rideDetails) => {
  const { rideId, driverName, pickupLocation, dropLocation, distance, duration, fare, paymentMethod } = rideDetails;
  
  const subject = 'Ride Completed - RapidRide Receipt';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">✅ Ride Completed</h2>
      <p>Thank you for riding with RapidRide!</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Receipt</h3>
        <p><strong>Ride ID:</strong> ${rideId}</p>
        <p><strong>Driver:</strong> ${driverName}</p>
        <p><strong>From:</strong> ${pickupLocation}</p>
        <p><strong>To:</strong> ${dropLocation}</p>
        <p><strong>Distance:</strong> ${distance} km</p>
        <p><strong>Duration:</strong> ${duration}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
        <p style="font-size: 18px;"><strong>Total Fare:</strong> ₹${fare}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
      </div>
      
      <p>We hope you had a great experience. Please rate your driver in the app!</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: riderEmail, subject, html });
};

/**
 * Send OTP email for verification
 */
const sendOTPEmail = async (userEmail, otp, userName) => {
  const subject = 'Your OTP - RapidRide';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2196F3;">🔐 Email Verification</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>Your One-Time Password (OTP) for RapidRide is:</p>
      
      <div style="background-color: #f5f5f5; padding: 30px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <h1 style="color: #2196F3; font-size: 36px; margin: 0; letter-spacing: 5px;">${otp}</h1>
      </div>
      
      <p><strong>This OTP is valid for 10 minutes.</strong></p>
      <p>If you didn't request this OTP, please ignore this email.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (userEmail, resetLink, userName) => {
  const subject = 'Password Reset Request - RapidRide';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #FF5722;">🔒 Password Reset Request</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      
      <p>Or copy and paste this link in your browser:</p>
      <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">${resetLink}</p>
      
      <p><strong>This link is valid for 1 hour.</strong></p>
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: userEmail, subject, html });
};

/**
 * Send welcome email to new users
 */
const sendWelcomeEmail = async (userEmail, userName, userRole) => {
  const subject = 'Welcome to RapidRide! 🎉';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4CAF50;">🎉 Welcome to RapidRide!</h2>
      <p>Hi ${userName},</p>
      <p>Thank you for joining RapidRide as a ${userRole}!</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        ${userRole === 'rider' ? `
          <p>As a rider, you can:</p>
          <ul>
            <li>Book rides instantly</li>
            <li>Track your driver in real-time</li>
            <li>Choose from multiple vehicle types</li>
            <li>Rate and review your trips</li>
          </ul>
        ` : `
          <p>As a driver, you can:</p>
          <ul>
            <li>Accept ride requests</li>
            <li>Navigate to pickup locations</li>
            <li>Track your earnings</li>
            <li>Manage your availability</li>
          </ul>
        `}
      </div>
      
      <p>Get started now and enjoy seamless rides!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Start Now
        </a>
      </div>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated message from RapidRide. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return await sendEmail({ to: userEmail, subject, html });
};

export {
  sendEmail,
  sendRideConfirmationEmail,
  sendRideAssignmentEmail,
  sendRideCompletionEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
