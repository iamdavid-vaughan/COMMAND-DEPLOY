const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3100;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// Initialize SQLite database with absolute path
const dbPath = path.join(__dirname, 'licenses.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    email TEXT,
    license_type TEXT NOT NULL,
    version_limit TEXT,
    max_activations INTEGER DEFAULT 1,
    current_activations INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    email TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_validated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_key) REFERENCES licenses(license_key)
  );

  CREATE TABLE IF NOT EXISTS validation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    email TEXT,
    version TEXT,
    success INTEGER,
    reason TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Utility: Check version compatibility
function isVersionAllowed(licenseVersion, currentVersion) {
  if (licenseVersion === 'LIFETIME' || licenseVersion === '99') return true;

  // Extract major version
  const licenseMajor = licenseVersion.split('.')[0].replace('v', '');
  const currentMajor = currentVersion.split('.')[0].replace('v', '');

  return licenseMajor === currentMajor;
}

// Utility: Generate validation token
function generateValidationToken(licenseKey, email, machineId) {
  const data = JSON.stringify({
    license: licenseKey,
    email: email,
    machine: machineId,
    timestamp: Date.now()
  });

  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// POST /api/v1/validate
// Validate a license key
app.post('/api/v1/validate', (req, res) => {
  const { license_key, email, version, machine_id } = req.body;

  if (!license_key || !email || !version || !machine_id) {
    return res.status(400).json({
      valid: false,
      reason: 'Missing required fields: license_key, email, version, machine_id'
    });
  }

  try {
    // Get license from database
    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND is_active = 1').get(license_key);

    if (!license) {
      logValidation(license_key, email, version, false, 'License key not found');
      return res.status(404).json({
        valid: false,
        reason: 'Invalid license key'
      });
    }

    // SUPER LICENSE - always valid
    if (license.license_type === 'SUPER') {
      logValidation(license_key, email, version, true, 'Super license validated');
      return res.json({
        valid: true,
        license_type: 'SUPER',
        message: 'Super license - unlimited access',
        validation_token: generateValidationToken(license_key, email, machine_id)
      });
    }

    // Check email match (except for SUPER)
    if (license.email && license.email !== email) {
      logValidation(license_key, email, version, false, 'Email mismatch');
      return res.status(403).json({
        valid: false,
        reason: 'License key is registered to a different email address'
      });
    }

    // Check version compatibility
    if (!isVersionAllowed(license.version_limit, version)) {
      logValidation(license_key, email, version, false, 'Version not allowed');
      return res.status(403).json({
        valid: false,
        reason: `This license is only valid for version ${license.version_limit}, you are using ${version}`
      });
    }

    // Check expiration
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      logValidation(license_key, email, version, false, 'License expired');
      return res.status(403).json({
        valid: false,
        reason: 'License has expired',
        expired_at: license.expires_at
      });
    }

    // Check activation limit
    const activation = db.prepare('SELECT * FROM activations WHERE license_key = ? AND machine_id = ?').get(license_key, machine_id);

    if (!activation) {
      // New machine - check if we can activate
      if (license.current_activations >= license.max_activations) {
        logValidation(license_key, email, version, false, 'Activation limit reached');
        return res.status(403).json({
          valid: false,
          reason: `License activation limit reached (${license.max_activations} machines)`,
          current_activations: license.current_activations
        });
      }

      // Activate new machine
      db.prepare('INSERT INTO activations (license_key, email, machine_id) VALUES (?, ?, ?)').run(license_key, email, machine_id);
      db.prepare('UPDATE licenses SET current_activations = current_activations + 1 WHERE license_key = ?').run(license_key);
    } else {
      // Update last validated timestamp
      db.prepare('UPDATE activations SET last_validated = CURRENT_TIMESTAMP WHERE id = ?').run(activation.id);
    }

    logValidation(license_key, email, version, true, 'Valid');

    res.json({
      valid: true,
      license_type: license.license_type,
      version_limit: license.version_limit,
      expires_at: license.expires_at,
      activations: {
        current: license.current_activations + (activation ? 0 : 1),
        max: license.max_activations
      },
      validation_token: generateValidationToken(license_key, email, machine_id)
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      valid: false,
      reason: 'Internal server error'
    });
  }
});

// POST /api/v1/activate
// Activate a license (explicit activation before first use)
app.post('/api/v1/activate', (req, res) => {
  const { license_key, email } = req.body;

  if (!license_key || !email) {
    return res.status(400).json({
      success: false,
      reason: 'Missing required fields: license_key, email'
    });
  }

  try {
    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ? AND is_active = 1').get(license_key);

    if (!license) {
      return res.status(404).json({
        success: false,
        reason: 'Invalid license key'
      });
    }

    // Super license doesn't need activation
    if (license.license_type === 'SUPER') {
      return res.json({
        success: true,
        message: 'Super license activated (no email binding required)',
        license_type: 'SUPER'
      });
    }

    // If license has email, check match
    if (license.email && license.email !== email) {
      return res.status(403).json({
        success: false,
        reason: 'This license is already registered to a different email address'
      });
    }

    // If no email set, bind to this email
    if (!license.email) {
      db.prepare('UPDATE licenses SET email = ? WHERE license_key = ?').run(email, license_key);
    }

    res.json({
      success: true,
      message: 'License activated successfully',
      license_type: license.license_type,
      version_limit: license.version_limit,
      max_activations: license.max_activations
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({
      success: false,
      reason: 'Internal server error'
    });
  }
});

// GET /api/v1/health
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper: Log validation attempts
function logValidation(license_key, email, version, success, reason) {
  db.prepare('INSERT INTO validation_log (license_key, email, version, success, reason) VALUES (?, ?, ?, ?, ?)')
    .run(license_key, email, version, success ? 1 : 0, reason);
}

// Start server
app.listen(PORT, () => {
  console.log(`🔐 Focal Deploy License Server running on port ${PORT}`);
  console.log(`📊 Database: licenses.db`);
  console.log(`🔑 Encryption key: ${ENCRYPTION_KEY.substring(0, 10)}...`);
});

module.exports = app;
