const {
  sendEmail,
  sendRideConfirmationEmail,
  sendRideAssignmentEmail,
  sendRideCompletionEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} = require('../config/email');
const logger = require('../config/logger');

/**
 * Email Service - Wrapper service for email functionality
 * This service provides methods to send various types of emails
 */

class EmailService {
  /**
   * Send a custom email
   */
  static async sendCustomEmail(to, subject, content, isHtml = true) {
    try {
      const result = isHtml 
        ? await sendEmail({ to, subject, html: content })
        : await sendEmail({ to, subject, text: content });
      
      return result;
    } catch (error) {
      logger.error('Error in sendCustomEmail', { error: error.message, to, subject });
      throw error;
    }
  }

  /**
   * Send ride confirmation email to rider
   */
  static async notifyRideConfirmation(rider, driver, ride) {
    try {
      const rideDetails = {
        rideId: ride._id,
        driverName: driver.name,
        vehicleName: driver.vehicle?.model || 'N/A',
        vehicleNumber: driver.vehicle?.plateNumber || 'N/A',
        pickupLocation: ride.pickupLocation?.address || 'N/A',
        dropLocation: ride.dropLocation?.address || 'N/A',
        estimatedFare: ride.estimatedFare || 0
      };

      return await sendRideConfirmationEmail(rider.email, rideDetails);
    } catch (error) {
      logger.error('Error in notifyRideConfirmation', { error: error.message, rideId: ride._id });
      throw error;
    }
  }

  /**
   * Send ride assignment notification to driver
   */
  static async notifyRideAssignment(driver, rider, ride) {
    try {
      const rideDetails = {
        rideId: ride._id,
        riderName: rider.name,
        pickupLocation: ride.pickupLocation?.address || 'N/A',
        dropLocation: ride.dropLocation?.address || 'N/A',
        estimatedFare: ride.estimatedFare || 0
      };

      return await sendRideAssignmentEmail(driver.email, rideDetails);
    } catch (error) {
      logger.error('Error in notifyRideAssignment', { error: error.message, rideId: ride._id });
      throw error;
    }
  }

  /**
   * Send ride completion receipt to rider
   */
  static async sendRideReceipt(rider, driver, ride) {
    try {
      const rideDetails = {
        rideId: ride._id,
        driverName: driver.name,
        pickupLocation: ride.pickupLocation?.address || 'N/A',
        dropLocation: ride.dropLocation?.address || 'N/A',
        distance: ride.distance ? (ride.distance / 1000).toFixed(2) : 'N/A',
        duration: ride.duration || 'N/A',
        fare: ride.fare || ride.estimatedFare || 0,
        paymentMethod: ride.paymentMethod || 'Cash'
      };

      return await sendRideCompletionEmail(rider.email, rideDetails);
    } catch (error) {
      logger.error('Error in sendRideReceipt', { error: error.message, rideId: ride._id });
      throw error;
    }
  }

  /**
   * Send OTP for email verification
   */
  static async sendVerificationOTP(userEmail, otp, userName) {
    try {
      return await sendOTPEmail(userEmail, otp, userName);
    } catch (error) {
      logger.error('Error in sendVerificationOTP', { error: error.message, email: userEmail });
      throw error;
    }
  }

  /**
   * Send password reset link
   */
  static async sendPasswordReset(userEmail, resetToken, userName) {
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/reset-password.html?token=${resetToken}`;
      return await sendPasswordResetEmail(userEmail, resetLink, userName);
    } catch (error) {
      logger.error('Error in sendPasswordReset', { error: error.message, email: userEmail });
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  static async sendWelcome(userEmail, userName, userRole) {
    try {
      return await sendWelcomeEmail(userEmail, userName, userRole);
    } catch (error) {
      logger.error('Error in sendWelcome', { error: error.message, email: userEmail });
      throw error;
    }
  }

  /**
   * Send ride cancellation notification
   */
  static async notifyRideCancellation(userEmail, userName, rideId, reason, userRole) {
    try {
      const subject = 'Ride Cancelled - RapidRide';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF5722;">❌ Ride Cancelled</h2>
          <p>Hi ${userName},</p>
          <p>Your ride (ID: ${rideId}) has been cancelled.</p>
          
          ${reason ? `
            <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #FF5722; margin: 20px 0;">
              <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
            </div>
          ` : ''}
          
          <p>${userRole === 'rider' ? 'You can book a new ride anytime from the app.' : 'You can accept new ride requests from the app.'}</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated message from RapidRide. Please do not reply to this email.
          </p>
        </div>
      `;

      return await sendEmail({ to: userEmail, subject, html });
    } catch (error) {
      logger.error('Error in notifyRideCancellation', { error: error.message, rideId });
      throw error;
    }
  }

  /**
   * Send driver approval notification
   */
  static async notifyDriverApproval(driverEmail, driverName, isApproved) {
    try {
      const subject = isApproved ? 'Driver Application Approved - RapidRide' : 'Driver Application Status - RapidRide';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${isApproved ? '#4CAF50' : '#FF5722'};">${isApproved ? '✅ Congratulations!' : '❌ Application Update'}</h2>
          <p>Hi ${driverName},</p>
          
          ${isApproved ? `
            <p>Your driver application has been approved! You can now start accepting rides.</p>
            
            <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Log in to your driver dashboard</li>
                <li>Go online to start receiving ride requests</li>
                <li>Complete your profile if needed</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/driver" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Start Driving
              </a>
            </div>
          ` : `
            <p>We regret to inform you that your driver application could not be approved at this time.</p>
            <p>Please contact our support team for more information.</p>
          `}
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated message from RapidRide. Please do not reply to this email.
          </p>
        </div>
      `;

      return await sendEmail({ to: driverEmail, subject, html });
    } catch (error) {
      logger.error('Error in notifyDriverApproval', { error: error.message, email: driverEmail });
      throw error;
    }
  }
}

module.exports = EmailService;
