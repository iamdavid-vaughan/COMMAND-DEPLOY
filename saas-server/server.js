/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focuswithfocal.com
 * For support: support@focuswithfocal.com
 *
 * @author DNS Publishing, LLC
 * @copyright 2025 DNS Publishing, LLC
 * @license Proprietary
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const chalk = require('chalk');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/authNew'); // New email-first authentication
const oauthRoutes = require('./routes/oauth'); // OAuth (Google/GitHub)
const twoFactorAuthRoutes = require('./routes/twoFactorAuth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const deploymentRoutes = require('./routes/deployments');
const templatesRoutes = require('./routes/templates');
const databasesRoutes = require('./routes/databases');
const credentialsRoutes = require('./routes/credentials');
const gcpCredentialsRoutes = require('./routes/gcpCredentials');
const azureCredentialsRoutes = require('./routes/azureCredentials');
const monitoringRoutes = require('./routes/monitoring');
const usageRoutes = require('./routes/usage');
const billingRoutes = require('./routes/billing');
const pricingRoutes = require('./routes/pricing');
const healthRoutes = require('./routes/health');
const auditRoutes = require('./routes/audit');
const passwordSecurityRoutes = require('./routes/password-security');
const apiKeysRoutes = require('./routes/api-keys');
const adminSettingsRoutes = require('./routes/admin-settings');
const storageRoutes = require('./routes/storage');
const logsRoutes = require('./routes/logs');
const emailManagementRoutes = require('./routes/emailManagement');
const postmarkWebhookRoutes = require('./routes/postmarkWebhook');
const sessionsRoutes = require('./routes/sessions');
const teamsRoutes = require('./routes/teams');
const contactRoutes = require('./routes/contact');
const statusRoutes = require('./routes/status');
const alertsRoutes = require('./routes/alerts');
const sslRoutes = require('./routes/ssl');
const systemAlertsRoutes = require('./routes/systemAlerts');
const appControlsRoutes = require('./routes/appControls');
const securityRoutes = require('./routes/security');
const sshKeysRoutes = require('./routes/sshKeys');
const dnsManagementRoutes = require('./routes/dnsManagement');
const { router: terminalRoutes, handleWebSocketUpgrade } = require('./routes/terminal');

// Import middleware
const { errorHandler } = require('./middleware/error-handler');
const { requestLogger } = require('./middleware/request-logger');
const { authenticate } = require('./middleware/auth');

// Import services
const { initializeDatabase } = require('./services/database');
const { initializeRedis } = require('./services/redis');
const { initializeModels } = require('./models');
const { startWorker } = require('./services/deploymentWorker');
const { initializeWebSocket } = require('./services/websocket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Trust proxy - Required when behind Nginx/load balancer
 * This allows express-rate-limit to correctly identify users via X-Forwarded-For header
 */
app.set('trust proxy', 1);

/**
 * Security Middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/**
 * Rate Limiting
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased for better UX)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);

/**
 * Body Parsing & Compression
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

/**
 * Static Files - Serve avatars and other public assets
 */
app.use('/avatars', express.static('public/avatars'));

/**
 * Logging
 */
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}
app.use(requestLogger);

// Response logging middleware - ONLY in development (security: never log tokens)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      if (req.path.includes('/auth/')) {
        try {
          const parsed = JSON.parse(data);
          // SECURITY: Never log full tokens, even in development
          if (parsed.token) {
            logger.debug('Auth response generated', {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              tokenLength: parsed.token.length
            });
          }
          if (parsed.user) {
            // Log user without sensitive fields
            const { password_hash, twofa_secret, ...safeUser } = parsed.user;
            logger.debug('Auth user data', { user: safeUser });
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
      originalSend.call(this, data);
    };
    next();
  });
}

/**
 * API Routes
 */
app.use('/api/health', healthRoutes);
app.use('/api/contact', contactRoutes); // Contact form (public)
app.use('/api/status', statusRoutes); // Status page (public)
app.use('/api/webhooks', postmarkWebhookRoutes); // Postmark webhooks (public)
app.use('/api/auth/2fa', twoFactorAuthRoutes); // 2FA routes (must come before /api/auth)
app.use('/api/auth', authRoutes); // Email-first authentication
app.use('/api/oauth', oauthRoutes); // OAuth (Google/GitHub)
app.use('/api/pricing', pricingRoutes); // Public pricing info
app.use('/api/user', authenticate, userRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/deployments', authenticate, deploymentRoutes);
app.use('/api/templates', authenticate, templatesRoutes);
app.use('/api/databases', authenticate, databasesRoutes);
app.use('/api/credentials', authenticate, credentialsRoutes);
app.use('/api/gcp-credentials', authenticate, gcpCredentialsRoutes);
app.use('/api/azure-credentials', authenticate, azureCredentialsRoutes);
app.use('/api/monitoring', monitoringRoutes); // Public endpoint for agents + authenticated for users
app.use('/api/usage', authenticate, usageRoutes);
// Mount public billing endpoints first (no auth)
app.use('/api/billing', billingRoutes);
// Note: billingRoutes handles its own auth on protected endpoints
app.use('/api/audit', authenticate, auditRoutes);
app.use('/api/password-security', authenticate, passwordSecurityRoutes);
app.use('/api/api-keys', authenticate, apiKeysRoutes);
app.use('/api/admin/settings', authenticate, adminSettingsRoutes);
app.use('/api/storage', authenticate, storageRoutes);
app.use('/api/logs', logsRoutes); // Super admin only - has its own auth check
app.use('/api/admin/emails', authenticate, emailManagementRoutes); // Super admin only - has its own auth check
app.use('/api/sessions', authenticate, sessionsRoutes); // Session management
app.use('/api/teams', authenticate, teamsRoutes); // Team management
app.use('/api/alerts', alertsRoutes); // Alert rules and history (has own auth)
app.use('/api/ssl', sslRoutes); // SSL certificate management (has own auth)
app.use('/api/admin', systemAlertsRoutes); // System alerts (super admin only, has own auth)
app.use('/api/app-controls', appControlsRoutes); // Application controls (has own auth)
app.use('/api/security', securityRoutes); // Security dashboard (has own auth)
app.use('/api/ssh-keys', authenticate, sshKeysRoutes); // SSH key management
app.use('/api/dns', authenticate, dnsManagementRoutes); // DNS management
app.use('/api/terminal', terminalRoutes); // Terminal auth endpoint

/**
 * Root Route
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Focal Deploy SaaS API',
    version: '1.0.0',
    status: 'operational',
    documentation: '/api/docs',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      user: '/api/user',
      admin: '/api/admin',
      deployments: '/api/deployments',
      credentials: '/api/credentials',
      usage: '/api/usage',
      billing: '/api/billing'
    }
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path
  });
});

/**
 * Error Handler
 */
app.use(errorHandler);

/**
 * Initialize Services & Start Server
 */
async function startServer() {
  try {
    logger.info('Starting Focal Deploy SaaS API Server', {
      nodeVersion: process.version,
      environment: NODE_ENV,
      port: PORT
    });

    // Initialize Database
    logger.info('Initializing database connection...');
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Models
    logger.info('Initializing database models...');
    initializeModels();
    logger.info('Database models initialized');

    // Initialize Redis
    logger.info('Initializing Redis connection...');
    await initializeRedis();
    logger.info('Redis connected successfully');

    // Start Deployment Worker
    logger.info('Starting deployment worker...', { pollInterval: '30s' });
    const stopWorker = startWorker(30000); // Poll every 30 seconds
    logger.info('Deployment worker started');

    // Store stopWorker function for graceful shutdown
    global.stopDeploymentWorker = stopWorker;

    // Initialize Account Cleanup Cron Job
    logger.info('Initializing account cleanup cron job...');
    const { initializeCleanupCron } = require('./services/accountCleanupService');
    initializeCleanupCron();
    logger.info('Cleanup cron job initialized', { schedule: 'daily at 2 AM' });

    // Initialize Email Cron Job
    logger.info('Initializing email cron job...');
    const emailCronJob = require('./services/emailCronJob');
    await emailCronJob.initialize();
    logger.info('Email cron job initialized', { schedule: 'every 5 minutes' });

    // Initialize Subscription/Payment Check Cron Job
    logger.info('Initializing subscription check cron job...');
    const cron = require('node-cron');
    const suspensionService = require('./services/suspensionService');
    // Run daily at 3 AM to check for delinquent subscriptions
    cron.schedule('0 3 * * *', async () => {
      try {
        logger.info('Running daily subscription delinquency check...');
        const result = await suspensionService.processDelinquentSubscriptions();
        logger.info('Subscription check complete', { processed: result.processed });
      } catch (error) {
        logger.error('Subscription check failed', { error: error.message });
      }
    });
    logger.info('Subscription check cron job initialized', { schedule: 'daily at 3 AM' });

    // Initialize WebSocket
    logger.info('Initializing WebSocket server...');
    initializeWebSocket(server);
    logger.info('WebSocket server initialized');

    // Initialize WebSocket server for SSH terminals
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });

    wss.on('connection', handleWebSocketUpgrade);

    // Handle WebSocket upgrade requests for terminal
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`);

      if (pathname === '/terminal') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          handleWebSocketUpgrade(ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    logger.info('Terminal WebSocket server initialized');

    // Start Server
    server.listen(PORT, () => {
      logger.info('Focal Deploy SaaS API is ready', {
        port: PORT,
        environment: NODE_ENV,
        apiUrl: `http://localhost:${PORT}`,
        healthUrl: `http://localhost:${PORT}/api/health`,
        websocket: 'enabled'
      });

      // Also log to console with colors for development
      if (NODE_ENV === 'development') {
        console.log(chalk.bold.green(`\n✅ Server running on port ${PORT}`));
        console.log(chalk.gray(`   Environment: ${NODE_ENV}`));
        console.log(chalk.gray(`   API URL: http://localhost:${PORT}`));
        console.log(chalk.gray(`   Health: http://localhost:${PORT}/api/health`));
        console.log(chalk.gray(`   WebSocket: enabled\n`));
      }
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received, shutting down gracefully...', { signal: 'SIGTERM' });
  if (global.stopDeploymentWorker) {
    global.stopDeploymentWorker();
    logger.info('Deployment worker stopped');
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.warn('SIGINT received, shutting down gracefully...', { signal: 'SIGINT' });
  if (global.stopDeploymentWorker) {
    global.stopDeploymentWorker();
    logger.info('Deployment worker stopped');
  }
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
