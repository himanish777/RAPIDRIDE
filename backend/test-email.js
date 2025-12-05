import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

console.log('📧 Testing Email Configuration\n');
console.log('Environment Variables:');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');

console.log('\n🔧 Creating transporter...');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log('\n✅ Verifying connection...');

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email verification failed:', error.message);
  } else {
    console.log('✅ Email service is ready!');
    
    // Send test email
    console.log('\n📨 Sending test email...');
    transporter.sendMail({
      from: `"RapidRide Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Test Email from RapidRide',
      text: 'If you receive this, email is working!',
      html: '<h1>✅ Email service is working!</h1>'
    }, (err, info) => {
      if (err) {
        console.log('❌ Failed to send test email:', err.message);
      } else {
        console.log('✅ Test email sent!', info.messageId);
      }
      process.exit(0);
    });
  }
});
