/**
 * OAuth Authentication Routes
 * Google and GitHub OAuth 2.0 integration
 */

const express = require('express');
const axios = require('axios');
const { generateToken } = require('../middleware/auth');
const { getModels } = require('../models');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

/**
 * GET /api/oauth/google
 * Redirect to Google OAuth consent screen
 */
router.get('/google', (req, res) => {
  const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.API_URL}/api/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.redirect(`${googleAuthUrl}?${params.toString()}`);
});

/**
 * GET /api/oauth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.API_URL}/api/oauth/google/callback`,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    // Fetch user info from Google
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id: googleId, email, name, given_name, family_name } = userInfoResponse.data;

    const { User } = getModels();

    // Check if user exists with this Google ID
    let user = await User.findOne({
      where: {
        oauth_provider: 'google',
        oauth_id: googleId
      }
    });

    // If not, check if user exists with this email
    if (!user) {
      user = await User.findOne({ where: { email } });

      if (user) {
        // Link existing email account to Google OAuth
        await user.update({
          oauth_provider: 'google',
          oauth_id: googleId,
          email_verified: true, // Google verifies emails
          is_active: true
        });

        console.log(`✅ [OAUTH] Linked existing account to Google: ${email}`);
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      user = await User.create({
        email,
        first_name: given_name || name.split(' ')[0] || '',
        last_name: family_name || name.split(' ').slice(1).join(' ') || '',
        oauth_provider: 'google',
        oauth_id: googleId,
        email_verified: true, // Google verifies emails
        is_active: true,
        password_hash: null, // OAuth users don't have passwords
        license_tier: 'starter',
        status: 'active'
      });

      console.log(`✅ [OAUTH] New user created via Google: ${email}`);

      // Send welcome email (non-blocking)
      sendWelcomeEmail(email, name).catch(err =>
        console.error('Error sending welcome email:', err)
      );
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      licenseTier: user.license_tier,
      role: user.role || 'user',
      superAdminFor: user.super_admin_for || []
    });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}&provider=google`);

  } catch (error) {
    console.error('❌ [OAUTH] Google OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

/**
 * GET /api/oauth/github
 * Redirect to GitHub OAuth authorization
 */
router.get('/github', (req, res) => {
  const githubAuthUrl = 'https://github.com/login/oauth/authorize';
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.API_URL}/api/oauth/github/callback`,
    scope: 'read:user user:email',
    allow_signup: 'true'
  });

  res.redirect(`${githubAuthUrl}?${params.toString()}`);
});

/**
 * GET /api/oauth/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.API_URL}/api/oauth/github/callback`
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const { access_token } = tokenResponse.data;

    // Fetch user info from GitHub
    const userInfoResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    const { id: githubId, email, name, login } = userInfoResponse.data;

    // GitHub doesn't always return email in user endpoint
    let userEmail = email;
    if (!userEmail) {
      const emailsResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
      userEmail = primaryEmail ? primaryEmail.email : emailsResponse.data[0]?.email;
    }

    if (!userEmail) {
      console.error('❌ [OAUTH] GitHub account has no email');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    const { User } = getModels();

    // Check if user exists with this GitHub ID
    let user = await User.findOne({
      where: {
        oauth_provider: 'github',
        oauth_id: githubId.toString()
      }
    });

    // If not, check if user exists with this email
    if (!user) {
      user = await User.findOne({ where: { email: userEmail } });

      if (user) {
        // Link existing email account to GitHub OAuth
        await user.update({
          oauth_provider: 'github',
          oauth_id: githubId.toString(),
          email_verified: true, // GitHub verifies emails
          is_active: true
        });

        console.log(`✅ [OAUTH] Linked existing account to GitHub: ${userEmail}`);
      }
    }

    // Create new user if doesn't exist
    if (!user) {
      const nameParts = (name || login).split(' ');
      user = await User.create({
        email: userEmail,
        first_name: nameParts[0] || login,
        last_name: nameParts.slice(1).join(' ') || '',
        oauth_provider: 'github',
        oauth_id: githubId.toString(),
        email_verified: true, // GitHub verifies emails
        is_active: true,
        password_hash: null, // OAuth users don't have passwords
        license_tier: 'starter',
        status: 'active'
      });

      console.log(`✅ [OAUTH] New user created via GitHub: ${userEmail}`);

      // Send welcome email (non-blocking)
      sendWelcomeEmail(userEmail, name || login).catch(err =>
        console.error('Error sending welcome email:', err)
      );
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      licenseTier: user.license_tier,
      role: user.role || 'user',
      superAdminFor: user.super_admin_for || []
    });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}&provider=github`);

  } catch (error) {
    console.error('❌ [OAUTH] GitHub OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

module.exports = router;
