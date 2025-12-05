# Nodemailer Setup Guide for RapidRide

## Email Configuration

The email service has been configured using Nodemailer. Follow these steps to set it up:

### 1. Gmail Setup (Recommended)

**Step 1: Enable 2-Factor Authentication**
- Go to your Google Account settings
- Navigate to Security
- Enable 2-Step Verification

**Step 2: Generate App Password**
- Go to Google Account > Security > 2-Step Verification
- Scroll down to "App passwords"
- Select app: "Mail"
- Select device: "Other (Custom name)" → Enter "RapidRide"
- Click "Generate"
- Copy the 16-character password

**Step 3: Update .env file**
```env
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-16-char-app-password"
FRONTEND_URL="http://localhost:5500"
```

### 2. Alternative Email Services

#### Outlook/Hotmail
```env
EMAIL_HOST="smtp-mail.outlook.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your-email@outlook.com"
EMAIL_PASS="your-password"
```

#### Yahoo
```env
EMAIL_HOST="smtp.mail.yahoo.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your-email@yahoo.com"
EMAIL_PASS="your-app-password"
```

#### SendGrid
```env
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="apikey"
EMAIL_PASS="your-sendgrid-api-key"
```

## Available Email Functions

### 1. **sendCustomEmail**
Send any custom email
```javascript
const EmailService = require('./services/emailService');

await EmailService.sendCustomEmail(
  'user@example.com',
  'Test Subject',
  '<h1>Hello World</h1>',
  true // isHtml
);
```

### 2. **notifyRideConfirmation**
Send ride confirmation to rider when driver accepts
```javascript
await EmailService.notifyRideConfirmation(rider, driver, ride);
```

### 3. **notifyRideAssignment**
Send ride assignment notification to driver
```javascript
await EmailService.notifyRideAssignment(driver, rider, ride);
```

### 4. **sendRideReceipt**
Send ride completion receipt to rider
```javascript
await EmailService.sendRideReceipt(rider, driver, ride);
```

### 5. **sendVerificationOTP**
Send OTP for email verification
```javascript
const otp = '123456'; // Generate 6-digit OTP
await EmailService.sendVerificationOTP('user@example.com', otp, 'John Doe');
```

### 6. **sendPasswordReset**
Send password reset link
```javascript
const resetToken = 'generated-jwt-token';
await EmailService.sendPasswordReset('user@example.com', resetToken, 'John Doe');
```

### 7. **sendWelcome**
Send welcome email to new users
```javascript
await EmailService.sendWelcome('user@example.com', 'John Doe', 'rider'); // or 'driver'
```

### 8. **notifyRideCancellation**
Send ride cancellation notification
```javascript
await EmailService.notifyRideCancellation(
  'user@example.com',
  'John Doe',
  'ride-id',
  'Cancelled by rider',
  'rider'
);
```

### 9. **notifyDriverApproval**
Send driver application approval/rejection
```javascript
await EmailService.notifyDriverApproval('driver@example.com', 'John Doe', true); // true = approved
```

## Integration Examples

### Example 1: Send email when ride is accepted
**File:** `backend/services/driverService.js`

Add to `acceptRideService` function:
```javascript
const EmailService = require('./emailService');

// After ride is accepted
const rider = await Rider.findById(ride.rider);
const driver = await Driver.findById(driverId);

// Send confirmation emails
await EmailService.notifyRideConfirmation(rider, driver, ride);
await EmailService.notifyRideAssignment(driver, rider, ride);
```

### Example 2: Send email when ride is completed
**File:** `backend/services/driverService.js`

Add to ride completion function:
```javascript
const EmailService = require('./emailService');

const rider = await Rider.findById(ride.rider);
const driver = await Driver.findById(ride.driver);

await EmailService.sendRideReceipt(rider, driver, ride);
```

### Example 3: Send welcome email on signup
**File:** `backend/services/authService.js`

Add to signup function:
```javascript
const EmailService = require('./emailService');

// After user is created
await EmailService.sendWelcome(user.email, user.name, user.role);
```

### Example 4: Send OTP for verification
**File:** `backend/controllers/authController.js`

```javascript
const EmailService = require('../services/emailService');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = generateOTP();
    
    // Store OTP in Redis with 10 min expiry
    await redisClient.setex(`otp:${email}`, 600, otp);
    
    // Send OTP email
    await EmailService.sendVerificationOTP(email, otp, 'User');
    
    res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

## Error Handling

All email functions return a result object:
```javascript
{
  success: true/false,
  messageId: 'unique-message-id', // if success
  error: 'error-message' // if failed
}
```

Handle errors gracefully:
```javascript
const result = await EmailService.sendWelcome(email, name, role);

if (!result.success) {
  logger.error('Failed to send welcome email', { email, error: result.error });
  // Don't block user flow, email is optional
}
```

## Testing

Test the email service:
```javascript
const EmailService = require('./services/emailService');

// Test custom email
EmailService.sendCustomEmail(
  'test@example.com',
  'Test Email',
  '<h1>This is a test</h1>'
).then(result => console.log(result));
```

## Important Notes

1. **Never commit real credentials** to git - use environment variables
2. **Gmail has daily sending limits** (500 emails/day for free accounts)
3. **Use App Passwords**, not your regular Gmail password
4. **Emails are async** - don't block user operations waiting for email
5. **Handle failures gracefully** - email failures shouldn't crash the app
6. **Test with real emails** during development

## Troubleshooting

### "Invalid login" error
- Make sure 2FA is enabled on Gmail
- Use App Password, not regular password
- Check EMAIL_USER matches the Gmail account

### "Connection timeout"
- Check firewall settings
- Try port 465 with EMAIL_SECURE="true"

### "Message rejected"
- Check spam settings on receiving email
- Verify sender email is correct

### Emails going to spam
- Use a verified domain email (not Gmail for production)
- Add SPF/DKIM records to your domain
- Use services like SendGrid/AWS SES for production
