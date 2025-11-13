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
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const chalk = require('chalk');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const deploymentRoutes = require('./routes/deployments');
const credentialsRoutes = require('./routes/credentials');
const usageRoutes = require('./routes/usage');
const billingRoutes = require('./routes/billing');
const pricingRoutes = require('./routes/pricing');
const healthRoutes = require('./routes/health');

// Import middleware
const { errorHandler } = require('./middleware/error-handler');
const { requestLogger } = require('./middleware/request-logger');
const { authenticate } = require('./middleware/auth');

// Import services
const { initializeDatabase } = require('./services/database');
const { initializeRedis } = require('./services/redis');
const { initializeModels } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

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
  max: 100, // Limit each IP to 100 requests per windowMs
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
 * Logging
 */
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}
app.use(requestLogger);

// Response logging middleware - log all auth responses
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (req.path.includes('/auth/')) {
      console.log(`📤 [RESPONSE] ${req.method} ${req.path} - Status: ${res.statusCode}`);
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) {
          console.log(`📤 [RESPONSE] Token in response: ${parsed.token.substring(0, 20)}... (${parsed.token.length} chars)`);
        }
        if (parsed.user) {
          console.log(`📤 [RESPONSE] User in response:`, JSON.stringify(parsed.user));
        }
      } catch (e) {
        // Not JSON, skip
      }
    }
    originalSend.call(this, data);
  };
  next();
});

/**
 * API Routes
 */
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pricing', pricingRoutes); // Public pricing info
app.use('/api/user', authenticate, userRoutes);
app.use('/api/deployments', authenticate, deploymentRoutes);
app.use('/api/credentials', authenticate, credentialsRoutes);
app.use('/api/usage', authenticate, usageRoutes);
app.use('/api/billing', authenticate, billingRoutes);

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
    console.log(chalk.bold.cyan('\n🚀 Starting Focal Deploy SaaS API Server...\n'));

    // Initialize Database
    console.log(chalk.gray('📦 Initializing database connection...'));
    await initializeDatabase();
    console.log(chalk.green('✅ Database connected'));

    // Initialize Models
    console.log(chalk.gray('📦 Initializing database models...'));
    initializeModels();
    console.log(chalk.green('✅ Models initialized\n'));

    // Initialize Redis
    console.log(chalk.gray('📦 Initializing Redis connection...'));
    await initializeRedis();
    console.log(chalk.green('✅ Redis connected\n'));

    // Start Server
    app.listen(PORT, () => {
      console.log(chalk.bold.green(`✅ Server running on port ${PORT}`));
      console.log(chalk.gray(`   Environment: ${NODE_ENV}`));
      console.log(chalk.gray(`   API URL: http://localhost:${PORT}`));
      console.log(chalk.gray(`   Health: http://localhost:${PORT}/api/health\n`));
      console.log(chalk.bold.cyan('🎯 Focal Deploy SaaS API is ready!\n'));
    });

  } catch (error) {
    console.error(chalk.red('❌ Failed to start server:'), error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n⚠️  SIGTERM received, shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n⚠️  SIGINT received, shutting down gracefully...'));
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
