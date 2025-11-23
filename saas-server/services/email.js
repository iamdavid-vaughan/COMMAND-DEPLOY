/**
 * Email Service - Send transactional emails via Postmark
 */

const postmark = require('postmark');
const logger = require('../utils/logger');

// Lazy-initialize Postmark client
let client = null;

function getPostmarkClient() {
  if (!client) {
    const serverToken = process.env.POSTMARK_SERVER_TOKEN;
    if (!serverToken) {
      logger.warn('Email: POSTMARK_SERVER_TOKEN not configured, emails will not be sent');
      return null;
    }
    client = new postmark.ServerClient(serverToken);
  }
  return client;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, resetToken, name) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping password reset email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const resetUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/reset-password?token=${resetToken}`;

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: 'Reset Your Focal Deploy Password',
      HtmlBody: `
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
      TextBody: `
Hello ${name || 'there'},

We received a request to reset your password for your Focal Deploy account.

Reset your password by clicking this link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Password reset email sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending password reset email', { email, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(email, name) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping welcome email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const loginUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/login`;

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: 'Welcome to Focal Deploy!',
      HtmlBody: `
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
      TextBody: `
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
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Welcome email sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending welcome email', { email, error: error.message, stack: error.stack });
    // Don't throw - welcome email failure shouldn't block registration
    return { success: false, error: error.message };
  }
}

/**
 * Send password changed notification
 */
async function sendPasswordChangedEmail(email, name) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping password changed email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const supportUrl = 'https://support.focuswithfocal.com';

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: 'Your Focal Deploy Password Was Changed',
      HtmlBody: `
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
      TextBody: `
Hello ${name || 'there'},

This is a confirmation that your Focal Deploy password was successfully changed.

⚠️ Didn't change your password?
If you didn't make this change, please contact our support team immediately at: ${supportUrl}

This is an automated security notification. For your account's safety, we recommend using a strong, unique password.

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Password changed notification sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending password changed email', { email, error: error.message, stack: error.stack });
    // Don't throw - notification failure shouldn't block password change
    return { success: false, error: error.message };
  }
}

/**
 * Send deployment started notification
 */
async function sendDeploymentStartedEmail(email, name, deploymentData) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping deployment started email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/dashboard/deployments/${deploymentData.id}`;

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: `Deployment Started: ${deploymentData.projectName}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Deployment Started</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2563eb; margin-top: 0;">🚀 Deployment Started</h2>
            <p>Hello ${name},</p>
            <p>Your deployment for <strong>${deploymentData.projectName}</strong> has started processing.</p>

            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2563eb;">Deployment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Project:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${deploymentData.projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Region:</td>
                  <td style="padding: 8px 0;">${deploymentData.region}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Instance Type:</td>
                  <td style="padding: 8px 0;">${deploymentData.instanceType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Status:</td>
                  <td style="padding: 8px 0;"><span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">RUNNING</span></td>
                </tr>
              </table>
            </div>

            <p>You can monitor the deployment progress in real-time from your dashboard.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Deployment
              </a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              We'll send you another email when the deployment completes.
            </p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Focal Deploy Team
            </p>
          </div>
        </body>
        </html>
      `,
      TextBody: `
Hello ${name},

Your deployment for ${deploymentData.projectName} has started processing.

Deployment Details:
- Project: ${deploymentData.projectName}
- Region: ${deploymentData.region}
- Instance Type: ${deploymentData.instanceType}
- Status: RUNNING

View deployment: ${dashboardUrl}

We'll send you another email when the deployment completes.

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Deployment started email sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending deployment started email', { email, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

/**
 * Send deployment success notification
 */
async function sendDeploymentSuccessEmail(email, name, deploymentData) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping deployment success email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/dashboard/deployments/${deploymentData.id}`;

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: `✅ Deployment Successful: ${deploymentData.projectName}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Deployment Successful</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h2 style="color: #16a34a; margin-top: 0;">✅ Deployment Successful!</h2>
            <p>Hello ${name},</p>
            <p>Great news! Your deployment for <strong>${deploymentData.projectName}</strong> has completed successfully.</p>

            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #16a34a;">Deployment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Project:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${deploymentData.projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Public IP:</td>
                  <td style="padding: 8px 0; font-family: monospace;">${deploymentData.publicIp || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Instance ID:</td>
                  <td style="padding: 8px 0; font-family: monospace;">${deploymentData.instanceId || 'N/A'}</td>
                </tr>
                ${deploymentData.domains && deploymentData.domains.length > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Domains:</td>
                  <td style="padding: 8px 0;">${deploymentData.domains.join(', ')}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #666;">Status:</td>
                  <td style="padding: 8px 0;"><span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">COMPLETED</span></td>
                </tr>
              </table>
            </div>

            <p>Your application is now live and ready to use!</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}"
                 style="background-color: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Deployment Details
              </a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              Need help? Contact support at support@focuswithfocal.com
            </p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Focal Deploy Team
            </p>
          </div>
        </body>
        </html>
      `,
      TextBody: `
Hello ${name},

Great news! Your deployment for ${deploymentData.projectName} has completed successfully.

Deployment Details:
- Project: ${deploymentData.projectName}
- Public IP: ${deploymentData.publicIp || 'N/A'}
- Instance ID: ${deploymentData.instanceId || 'N/A'}
${deploymentData.domains && deploymentData.domains.length > 0 ? `- Domains: ${deploymentData.domains.join(', ')}` : ''}
- Status: COMPLETED

Your application is now live and ready to use!

View deployment details: ${dashboardUrl}

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Deployment success email sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending deployment success email', { email, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

/**
 * Send deployment failed notification
 */
async function sendDeploymentFailedEmail(email, name, deploymentData) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping deployment failed email (Postmark not configured)', { email });
    return { success: false, error: 'Email service not configured' };
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/dashboard/deployments/${deploymentData.id}`;
  const supportUrl = 'https://support.focuswithfocal.com';

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@focuswithfocal.com',
      To: email,
      Subject: `❌ Deployment Failed: ${deploymentData.projectName}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Deployment Failed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h2 style="color: #dc2626; margin-top: 0;">❌ Deployment Failed</h2>
            <p>Hello ${name},</p>
            <p>Unfortunately, your deployment for <strong>${deploymentData.projectName}</strong> encountered an error and could not be completed.</p>

            <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; border-left: 4px solid #dc2626; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #dc2626;">Error Details</h3>
              <p style="margin: 0; font-family: monospace; font-size: 14px; word-break: break-word;">
                ${deploymentData.errorMessage || 'An unknown error occurred during deployment.'}
              </p>
            </div>

            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2563eb;">Deployment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Project:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${deploymentData.projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Region:</td>
                  <td style="padding: 8px 0;">${deploymentData.region}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Instance Type:</td>
                  <td style="padding: 8px 0;">${deploymentData.instanceType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Status:</td>
                  <td style="padding: 8px 0;"><span style="background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">FAILED</span></td>
                </tr>
              </table>
            </div>

            <h3 style="color: #2563eb;">Next Steps:</h3>
            <ul style="list-style: none; padding-left: 0;">
              <li style="padding: 8px 0;">✓ Review the deployment logs for detailed error information</li>
              <li style="padding: 8px 0;">✓ Check your AWS credentials and permissions</li>
              <li style="padding: 8px 0;">✓ Verify your deployment configuration</li>
              <li style="padding: 8px 0;">✓ Contact support if the issue persists</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
                View Deployment Logs
              </a>
              <a href="${supportUrl}"
                 style="background-color: #6b7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
                Contact Support
              </a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              Need assistance? Our support team is here to help at support@focuswithfocal.com
            </p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Focal Deploy Team
            </p>
          </div>
        </body>
        </html>
      `,
      TextBody: `
Hello ${name},

Unfortunately, your deployment for ${deploymentData.projectName} encountered an error and could not be completed.

Error Details:
${deploymentData.errorMessage || 'An unknown error occurred during deployment.'}

Deployment Details:
- Project: ${deploymentData.projectName}
- Region: ${deploymentData.region}
- Instance Type: ${deploymentData.instanceType}
- Status: FAILED

Next Steps:
- Review the deployment logs for detailed error information
- Check your AWS credentials and permissions
- Verify your deployment configuration
- Contact support if the issue persists

View deployment logs: ${dashboardUrl}
Contact support: ${supportUrl}

Need assistance? Our support team is here to help at support@focuswithfocal.com

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Deployment failed email sent', { email, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending deployment failed email', { email, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

/**
 * Send alert notification email
 */
async function sendAlertEmail({ to, deploymentName, alertName, message, severity, triggeredValue }) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping alert email (Postmark not configured)', { to });
    return { success: false, error: 'Email service not configured' };
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/dashboard/monitoring`;
  const severityColors = {
    critical: '#dc2626',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  const severityColor = severityColors[severity] || severityColors.warning;

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'alerts@focuswithfocal.com',
      To: to,
      Subject: `[${severity.toUpperCase()}] ${alertName} - ${deploymentName}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Alert Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
            <div style="background-color: ${severityColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 20px;">⚠️ Alert Triggered</h2>
            </div>

            <h3 style="color: #1f2937; margin-top: 0;">${alertName}</h3>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Deployment:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${deploymentName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Severity:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; color: ${severityColor}; font-weight: bold;">${severity.toUpperCase()}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Value:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${triggeredValue}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Time:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date().toLocaleString()}</td>
              </tr>
            </table>

            <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 5px;">
              <strong>Details:</strong><br>
              ${message}
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Monitoring Dashboard
              </a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              This is an automated alert from Focal Deploy monitoring system.<br>
              To configure alert settings, visit your dashboard.
            </p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Focal Deploy Team
            </p>
          </div>
        </body>
        </html>
      `,
      TextBody: `
⚠️ ALERT TRIGGERED

${alertName}

Deployment: ${deploymentName}
Severity: ${severity.toUpperCase()}
Value: ${triggeredValue}
Time: ${new Date().toLocaleString()}

Details:
${message}

View your monitoring dashboard:
${dashboardUrl}

This is an automated alert from Focal Deploy monitoring system.

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: Alert email sent', { to, deploymentName, alertName, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending alert email', { to, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

/**
 * Send SSL certificate expiration warning
 */
async function sendSSLExpirationEmail({ to, deploymentName, domain, daysUntilExpiry, expiresAt }) {
  const client = getPostmarkClient();
  if (!client) {
    logger.warn('Email: Skipping SSL expiration email (Postmark not configured)', { to });
    return { success: false, error: 'Email service not configured' };
  }

  const dashboardUrl = `${process.env.APP_URL || 'https://app.focuswithfocal.com'}/dashboard/monitoring`;
  const isUrgent = daysUntilExpiry <= 7;
  const severityColor = isUrgent ? '#dc2626' : '#f59e0b';

  try {
    const result = await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL || 'alerts@focuswithfocal.com',
      To: to,
      Subject: `${isUrgent ? '[URGENT] ' : ''}SSL Certificate Expiring Soon - ${domain}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SSL Certificate Expiring</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
            <div style="background-color: ${severityColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 20px;">🔒 SSL Certificate ${isUrgent ? 'EXPIRING SOON' : 'Needs Renewal'}</h2>
            </div>

            <p>The SSL certificate for <strong>${domain}</strong> will expire in <strong>${daysUntilExpiry} days</strong>.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Deployment:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${deploymentName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Domain:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${domain}</td>
              </tr>
              <tr style="background-color: #f3f4f6;">
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Expires:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb; color: ${severityColor}; font-weight: bold;">${new Date(expiresAt).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Days Remaining:</td>
                <td style="padding: 10px; border: 1px solid #e5e7eb;">${daysUntilExpiry} days</td>
              </tr>
            </table>

            <div style="background-color: ${isUrgent ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${severityColor}; padding: 12px; border-radius: 5px;">
              <strong>${isUrgent ? '⚠️ URGENT ACTION REQUIRED' : '⚠️ Action Recommended'}:</strong><br>
              Please renew your SSL certificate as soon as possible to avoid service interruption.
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Renew SSL Certificate
              </a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              Focal Deploy can automatically renew your SSL certificates. Visit your dashboard to enable auto-renewal.
            </p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              The Focal Deploy Team
            </p>
          </div>
        </body>
        </html>
      `,
      TextBody: `
🔒 SSL CERTIFICATE ${isUrgent ? 'EXPIRING SOON' : 'NEEDS RENEWAL'}

The SSL certificate for ${domain} will expire in ${daysUntilExpiry} days.

Deployment: ${deploymentName}
Domain: ${domain}
Expires: ${new Date(expiresAt).toLocaleDateString()}
Days Remaining: ${daysUntilExpiry}

${isUrgent ? '⚠️ URGENT ACTION REQUIRED' : '⚠️ Action Recommended'}:
Please renew your SSL certificate as soon as possible to avoid service interruption.

Renew your certificate:
${dashboardUrl}

Focal Deploy can automatically renew your SSL certificates. Visit your dashboard to enable auto-renewal.

Best regards,
The Focal Deploy Team
      `,
      MessageStream: 'outbound'
    });

    logger.info('Email: SSL expiration email sent', { to, domain, daysUntilExpiry, messageId: result.MessageID });
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    logger.error('Email: Error sending SSL expiration email', { to, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
}

/**
 * Send payment failed email (Day 0)
 */
async function sendPaymentFailedEmail(email, name, data) {
  const { gracePeriodEnds, subscriptionPlan } = data;
  const gracePeriodDate = new Date(gracePeriodEnds).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 8px 0; color: #92400E;">Payment Issue</h2>
      <p style="margin: 0; color: #92400E;">Your recent payment could not be processed.</p>
    </div>

    <p>Hi ${name},</p>

    <p>We were unable to process your payment for your <strong>${subscriptionPlan || 'Focal Deploy'}</strong> subscription.</p>

    <p><strong>What happens next:</strong></p>
    <ul>
      <li>Please update your payment method as soon as possible</li>
      <li>Your deployments will be suspended in 24 hours if payment is not received</li>
      <li>All resources will be terminated on <strong>${gracePeriodDate}</strong> if the issue is not resolved</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/billing" style="display: inline-block; padding: 14px 28px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Update Payment Method</a>
    </div>

    <p style="color: #6B7280; font-size: 14px;">If you have any questions, please contact support.</p>
  </div>
</body>
</html>`;

  return sendEmail(email, 'Action Required: Payment Issue with Your Focal Deploy Account', htmlBody);
}

/**
 * Send suspension warning email (Day 1)
 */
async function sendSuspensionWarningEmail(email, name, data) {
  const { daysSinceFailure, gracePeriodEnds } = data;
  const gracePeriodDate = new Date(gracePeriodEnds).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 8px 0; color: #991B1B;">Deployments Suspended</h2>
      <p style="margin: 0; color: #991B1B;">Your deployments have been suspended due to payment issues.</p>
    </div>

    <p>Hi ${name},</p>

    <p>Due to the unresolved payment issue, we have suspended your deployments. Your servers have been stopped, but your data is safe.</p>

    <p><strong>Important:</strong></p>
    <ul>
      <li>Update your payment method to restore your deployments immediately</li>
      <li>Your data and configuration are preserved</li>
      <li>If payment is not received by <strong>${gracePeriodDate}</strong>, all resources will be permanently deleted</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/billing" style="display: inline-block; padding: 14px 28px; background: #DC2626; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Update Payment Now</a>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(email, 'URGENT: Your Focal Deploy Deployments Have Been Suspended', htmlBody);
}

/**
 * Send final warning email (Day 3)
 */
async function sendFinalWarningEmail(email, name, data) {
  const { terminationDate } = data;
  const termDate = new Date(terminationDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #7F1D1D; color: white; padding: 20px; margin-bottom: 24px; border-radius: 8px;">
      <h2 style="margin: 0 0 8px 0;">FINAL WARNING: Account Termination Imminent</h2>
      <p style="margin: 0;">Your account and all deployments will be permanently deleted on ${termDate}</p>
    </div>

    <p>Hi ${name},</p>

    <p>This is your final warning. Your payment issue has not been resolved, and your account is scheduled for permanent termination.</p>

    <p><strong>On ${termDate}:</strong></p>
    <ul style="color: #991B1B;">
      <li>All EC2 instances will be terminated</li>
      <li>All S3 buckets and data will be deleted</li>
      <li>All configuration and backups will be removed</li>
      <li><strong>This action cannot be undone</strong></li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/billing" style="display: inline-block; padding: 14px 28px; background: #7F1D1D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">SAVE MY ACCOUNT</a>
    </div>

    <p>If you intended to cancel your account, no action is needed.</p>
  </div>
</body>
</html>`;

  return sendEmail(email, 'FINAL WARNING: Your Focal Deploy Account Will Be Deleted', htmlBody);
}

/**
 * Send termination notice email (Day 5+)
 */
async function sendTerminationNoticeEmail(email, name) {
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #6B7280;">Account Terminated</h2>

    <p>Hi ${name},</p>

    <p>Due to unresolved payment issues, your Focal Deploy account has been terminated and all resources have been deleted.</p>

    <p>If you'd like to use Focal Deploy again in the future, you're welcome to create a new account.</p>

    <p style="color: #6B7280;">Thank you for trying Focal Deploy.</p>
  </div>
</body>
</html>`;

  return sendEmail(email, 'Your Focal Deploy Account Has Been Terminated', htmlBody);
}

// Helper function to send email
async function sendEmail(to, subject, htmlBody) {
  try {
    const client = new (require('postmark').ServerClient)(process.env.POSTMARK_SERVER_TOKEN);
    await client.sendEmail({
      From: process.env.EMAIL_FROM || 'noreply@focuswithfocal.com',
      To: to,
      Subject: subject,
      HtmlBody: htmlBody
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendDeploymentStartedEmail,
  sendDeploymentSuccessEmail,
  sendDeploymentFailedEmail,
  sendAlertEmail,
  sendSSLExpirationEmail,
  sendPaymentFailedEmail,
  sendSuspensionWarningEmail,
  sendFinalWarningEmail,
  sendTerminationNoticeEmail
};
