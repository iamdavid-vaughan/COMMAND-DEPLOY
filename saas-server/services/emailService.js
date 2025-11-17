/**
 * Email Service - Send transactional emails
 * Uses nodemailer for email delivery
 */

const nodemailer = require('nodemailer');

// Create transporter (configure with your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

/**
 * Send email verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} name - User's name
 */
async function sendVerificationEmail(email, token, name = '') {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Focal Deploy" <noreply@focuswithfocal.com>',
    to: email,
    subject: 'Verify Your Email - Focal Deploy',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Focal Deploy!</h1>
          </div>
          <div class="content">
            <p>Hi${name ? ' ' + name : ''},</p>

            <p>Thanks for signing up! To complete your account setup and set your password, please verify your email address by clicking the button below:</p>

            <center>
              <a href="${verificationUrl}" class="button">Verify Email & Set Password</a>
            </center>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;"><a href="${verificationUrl}">${verificationUrl}</a></p>

            <div class="warning">
              <strong>⏱ This link expires in 24 hours.</strong>
            </div>

            <p>If you didn't create an account with Focal Deploy, you can safely ignore this email.</p>

            <p>Best regards,<br>The Focal Deploy Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Focal Deploy. All rights reserved.</p>
            <p>If you're having trouble clicking the button, copy and paste the URL above into your web browser.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi${name ? ' ' + name : ''},

Thanks for signing up for Focal Deploy! To complete your account setup and set your password, please verify your email address by visiting this link:

${verificationUrl}

This link expires in 24 hours.

If you didn't create an account with Focal Deploy, you can safely ignore this email.

Best regards,
The Focal Deploy Team
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} name - User's name
 */
async function sendPasswordResetEmail(email, token, name = '') {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Focal Deploy" <noreply@focuswithfocal.com>',
    to: email,
    subject: 'Reset Your Password - Focal Deploy',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          .security { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 12px; margin: 20px 0; color: #0c5460; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi${name ? ' ' + name : ''},</p>

            <p>We received a request to reset your password for your Focal Deploy account. Click the button below to choose a new password:</p>

            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;"><a href="${resetUrl}">${resetUrl}</a></p>

            <div class="warning">
              <strong>⏱ This link expires in 4 hours.</strong>
            </div>

            <div class="security">
              <strong>🔒 Security Note:</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
            </div>

            <p>Best regards,<br>The Focal Deploy Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Focal Deploy. All rights reserved.</p>
            <p>If you're having trouble clicking the button, copy and paste the URL above into your web browser.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi${name ? ' ' + name : ''},

We received a request to reset your password for your Focal Deploy account. Visit this link to choose a new password:

${resetUrl}

This link expires in 4 hours.

If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.

Best regards,
The Focal Deploy Team
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
async function sendWelcomeEmail(email, name = '') {
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Focal Deploy" <noreply@focuswithfocal.com>',
    to: email,
    subject: 'Welcome to Focal Deploy!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome Aboard!</h1>
          </div>
          <div class="content">
            <p>Hi${name ? ' ' + name : ''},</p>

            <p>Your account is now active! You're ready to start deploying your applications with Focal Deploy.</p>

            <h3>Get Started:</h3>
            <div class="feature">
              <strong>1. Connect Your AWS/GCP Account</strong><br>
              Securely link your cloud provider credentials in the dashboard.
            </div>
            <div class="feature">
              <strong>2. Deploy Your First Server</strong><br>
              Launch EC2/GCE instances with our easy-to-use deployment wizard.
            </div>
            <div class="feature">
              <strong>3. Deploy Your Application</strong><br>
              Choose from templates or upload your own code to deploy.
            </div>

            <center>
              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
            </center>

            <p>Need help? Check out our documentation or contact support at support@focuswithfocal.com</p>

            <p>Happy deploying!<br>The Focal Deploy Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Focal Deploy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw - welcome email is non-critical
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
