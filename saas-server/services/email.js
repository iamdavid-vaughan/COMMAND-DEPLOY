/**
 * Email Service - Send transactional emails
 */

const nodemailer = require('nodemailer');

// Lazy-initialize transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // e.g., noreply@focuswithfocal.com
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, resetToken, name) {
  const resetUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"Focal Deploy" <noreply@focuswithfocal.com>`,
    to: email,
    subject: 'Reset Your Focal Deploy Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Reset Your Password</h2>
          <p>Hello ${name || 'there'},</p>
          <p>We received a request to reset your password for your Focal Deploy account. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="background-color: #e5e7eb; padding: 10px; border-radius: 5px; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            This link will expire in 1 hour for security reasons.<br>
            If you didn't request a password reset, please ignore this email or contact support if you have concerns.
          </p>
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            The Focal Deploy Team
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${name || 'there'},

We received a request to reset your password for your Focal Deploy account.

Reset your password by clicking this link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The Focal Deploy Team
    `
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ [EMAIL] Password reset email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending password reset email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(email, name) {
  const loginUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/login`;

  const mailOptions = {
    from: `"Focal Deploy" <noreply@focuswithfocal.com>`,
    to: email,
    subject: 'Welcome to Focal Deploy!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Focal Deploy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Welcome to Focal Deploy!</h2>
          <p>Hello ${name},</p>
          <p>Thank you for joining Focal Deploy. We're excited to help you streamline your deployment workflow.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          <h3 style="color: #2563eb;">Getting Started:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;">✓ Connect your AWS credentials</li>
            <li style="padding: 8px 0;">✓ Configure your first deployment</li>
            <li style="padding: 8px 0;">✓ Explore our API documentation</li>
          </ul>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            Need help? Check out our <a href="https://docs.focuswithfocal.com" style="color: #2563eb;">documentation</a> or contact support at support@focuswithfocal.com
          </p>
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            The Focal Deploy Team
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${name},

Thank you for joining Focal Deploy. We're excited to help you streamline your deployment workflow.

Get started by logging in at: ${loginUrl}

Getting Started:
- Connect your AWS credentials
- Configure your first deployment
- Explore our API documentation

Need help? Check out our documentation at https://docs.focuswithfocal.com or contact support at support@focuswithfocal.com

Best regards,
The Focal Deploy Team
    `
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ [EMAIL] Welcome email sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending welcome email to ${email}:`, error);
    // Don't throw - welcome email failure shouldn't block registration
    return { success: false, error: error.message };
  }
}

/**
 * Send password changed notification
 */
async function sendPasswordChangedEmail(email, name) {
  const supportUrl = 'https://support.focuswithfocal.com';

  const mailOptions = {
    from: `"Focal Deploy" <noreply@focuswithfocal.com>`,
    to: email,
    subject: 'Your Focal Deploy Password Was Changed',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Password Changed</h2>
          <p>Hello ${name || 'there'},</p>
          <p>This is a confirmation that your Focal Deploy password was successfully changed.</p>
          <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 5px; margin: 20px 0;">
            <strong>⚠️ Didn't change your password?</strong><br>
            If you didn't make this change, please contact our support team immediately.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${supportUrl}"
               style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Contact Support
            </a>
          </div>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            This is an automated security notification. For your account's safety, we recommend using a strong, unique password.
          </p>
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            The Focal Deploy Team
          </p>
        </div>
      </body>
      </html>
    `,
    text: `
Hello ${name || 'there'},

This is a confirmation that your Focal Deploy password was successfully changed.

⚠️ Didn't change your password?
If you didn't make this change, please contact our support team immediately at: ${supportUrl}

This is an automated security notification. For your account's safety, we recommend using a strong, unique password.

Best regards,
The Focal Deploy Team
    `
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ [EMAIL] Password changed notification sent to ${email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending password changed email to ${email}:`, error);
    // Don't throw - notification failure shouldn't block password change
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail
};
