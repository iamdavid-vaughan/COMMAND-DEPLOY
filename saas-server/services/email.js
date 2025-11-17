/**
 * Email Service - Send transactional emails via Postmark
 */

const postmark = require('postmark');

// Lazy-initialize Postmark client
let client = null;

function getPostmarkClient() {
  if (!client) {
    const serverToken = process.env.POSTMARK_SERVER_TOKEN;
    if (!serverToken) {
      console.warn('⚠️  [EMAIL] POSTMARK_SERVER_TOKEN not configured, emails will not be sent');
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
    console.warn('⚠️  [EMAIL] Skipping password reset email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Password reset email sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending password reset email to ${email}:`, error);
    throw error;
  }
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(email, name) {
  const client = getPostmarkClient();
  if (!client) {
    console.warn('⚠️  [EMAIL] Skipping welcome email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Welcome email sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
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
  const client = getPostmarkClient();
  if (!client) {
    console.warn('⚠️  [EMAIL] Skipping password changed email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Password changed notification sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending password changed email to ${email}:`, error);
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
    console.warn('⚠️  [EMAIL] Skipping deployment started email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Deployment started email sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending deployment started email to ${email}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send deployment success notification
 */
async function sendDeploymentSuccessEmail(email, name, deploymentData) {
  const client = getPostmarkClient();
  if (!client) {
    console.warn('⚠️  [EMAIL] Skipping deployment success email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Deployment success email sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending deployment success email to ${email}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send deployment failed notification
 */
async function sendDeploymentFailedEmail(email, name, deploymentData) {
  const client = getPostmarkClient();
  if (!client) {
    console.warn('⚠️  [EMAIL] Skipping deployment failed email (Postmark not configured)');
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

    console.log(`✅ [EMAIL] Deployment failed email sent to ${email}:`, result.MessageID);
    return { success: true, messageId: result.MessageID };
  } catch (error) {
    console.error(`❌ [EMAIL] Error sending deployment failed email to ${email}:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendDeploymentStartedEmail,
  sendDeploymentSuccessEmail,
  sendDeploymentFailedEmail
};
