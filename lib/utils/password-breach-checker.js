const crypto = require('crypto');
const https = require('https');
const { logger } = require('./logger');

/**
 * PasswordBreachChecker - Check passwords against Have I Been Pwned API
 *
 * Uses the k-anonymity model to securely check if passwords have been
 * compromised in data breaches without sending the actual password.
 *
 * How it works:
 * 1. Hash the password with SHA-1
 * 2. Send only the first 5 characters of the hash to HIBP API
 * 3. Receive a list of hash suffixes that match
 * 4. Check if our hash suffix is in the list locally
 *
 * This ensures the actual password is never transmitted over the network.
 */
class PasswordBreachChecker {
  constructor(options = {}) {
    this.logger = logger;
    this.apiUrl = 'api.pwnedpasswords.com';
    this.userAgent = options.userAgent || 'Focal-Deploy-Security-Checker';
    this.timeout = options.timeout || 10000;
  }

  /**
   * Check if a password has been compromised in known data breaches
   * @param {string} password - The password to check
   * @returns {Object} Result object with isBreached, count, and recommendations
   */
  async checkPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      // Hash the password with SHA-1
      const hash = this.hashPassword(password);
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      // Query HIBP API with the hash prefix
      const breaches = await this.queryHIBPAPI(prefix);

      // Check if our hash suffix is in the results
      const match = breaches.find(breach => breach.suffix === suffix);

      if (match) {
        return {
          isBreached: true,
          count: match.count,
          severity: this.getSeverity(match.count),
          recommendation: this.getRecommendation(match.count),
          hash: hash
        };
      }

      return {
        isBreached: false,
        count: 0,
        severity: 'safe',
        recommendation: 'Password has not been found in known data breaches.',
        hash: hash
      };

    } catch (error) {
      this.logger.error('Password breach check failed:', error.message);
      throw error;
    }
  }

  /**
   * Hash password with SHA-1 (as required by HIBP API)
   * @param {string} password - Password to hash
   * @returns {string} Uppercase SHA-1 hash
   */
  hashPassword(password) {
    return crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Query Have I Been Pwned API
   * @param {string} prefix - First 5 characters of the SHA-1 hash
   * @returns {Array} Array of {suffix, count} objects
   */
  async queryHIBPAPI(prefix) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiUrl,
        path: `/range/${prefix}`,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Add-Padding': 'true' // Request padding for additional privacy
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            const breaches = this.parseHIBPResponse(data);
            resolve(breaches);
          } else if (res.statusCode === 404) {
            // No breaches found for this prefix
            resolve([]);
          } else {
            reject(new Error(`HIBP API returned status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to connect to HIBP API: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HIBP API request timed out'));
      });

      req.end();
    });
  }

  /**
   * Parse HIBP API response
   * @param {string} data - Response data from HIBP API
   * @returns {Array} Parsed array of {suffix, count} objects
   */
  parseHIBPResponse(data) {
    return data
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [suffix, count] = line.split(':');
        return {
          suffix: suffix.trim(),
          count: parseInt(count.trim(), 10)
        };
      });
  }

  /**
   * Get severity level based on breach count
   * @param {number} count - Number of times password appeared in breaches
   * @returns {string} Severity level
   */
  getSeverity(count) {
    if (count >= 100000) return 'critical';
    if (count >= 10000) return 'high';
    if (count >= 1000) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on breach count
   * @param {number} count - Number of times password appeared in breaches
   * @returns {string} Recommendation message
   */
  getRecommendation(count) {
    if (count >= 100000) {
      return `🚨 CRITICAL: This password has been seen ${count.toLocaleString()} times in data breaches. Change it IMMEDIATELY across all services!`;
    }
    if (count >= 10000) {
      return `⚠️  HIGH RISK: This password has been seen ${count.toLocaleString()} times in data breaches. Change it as soon as possible.`;
    }
    if (count >= 1000) {
      return `⚠️  MEDIUM RISK: This password has been seen ${count.toLocaleString()} times in data breaches. Consider changing it soon.`;
    }
    return `⚠️  This password has been seen ${count.toLocaleString()} times in data breaches. You should change it.`;
  }

  /**
   * Batch check multiple passwords
   * @param {Array<string>} passwords - Array of passwords to check
   * @returns {Array<Object>} Array of check results
   */
  async checkMultiple(passwords) {
    const results = [];

    for (const password of passwords) {
      try {
        const result = await this.checkPassword(password);
        results.push(result);

        // Add a small delay between requests to be respectful to the API
        await this.delay(100);
      } catch (error) {
        results.push({
          isBreached: null,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check password strength in addition to breach status
   * @param {string} password - Password to evaluate
   * @returns {Object} Comprehensive password assessment
   */
  async checkPasswordSecurity(password) {
    const breachResult = await this.checkPassword(password);
    const strengthResult = this.checkPasswordStrength(password);

    return {
      ...breachResult,
      strength: strengthResult,
      overallSecurity: this.calculateOverallSecurity(breachResult, strengthResult)
    };
  }

  /**
   * Check password strength
   * @param {string} password - Password to check
   * @returns {Object} Strength assessment
   */
  checkPasswordStrength(password) {
    const checks = {
      length: password.length >= 12,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      notCommonPattern: !this.isCommonPattern(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    const maxScore = Object.keys(checks).length;

    let strength = 'weak';
    if (score >= 5) strength = 'strong';
    else if (score >= 3) strength = 'medium';

    return {
      score: `${score}/${maxScore}`,
      strength,
      checks,
      recommendations: this.getStrengthRecommendations(checks)
    };
  }

  /**
   * Check if password matches common patterns
   * @param {string} password - Password to check
   * @returns {boolean} True if password matches common pattern
   */
  isCommonPattern(password) {
    const commonPatterns = [
      /^password/i,
      /^123+/,
      /^qwerty/i,
      /^abc+/i,
      /^admin/i,
      /^letmein/i,
      /^\d{4,}$/, // Only numbers
      /^[a-z]+\d+$/, // Word followed by numbers (e.g., password123)
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  /**
   * Get recommendations for improving password strength
   * @param {Object} checks - Password strength checks
   * @returns {Array<string>} Array of recommendations
   */
  getStrengthRecommendations(checks) {
    const recommendations = [];

    if (!checks.length) {
      recommendations.push('Use at least 12 characters');
    }
    if (!checks.hasUpperCase) {
      recommendations.push('Add uppercase letters (A-Z)');
    }
    if (!checks.hasLowerCase) {
      recommendations.push('Add lowercase letters (a-z)');
    }
    if (!checks.hasNumbers) {
      recommendations.push('Add numbers (0-9)');
    }
    if (!checks.hasSpecialChars) {
      recommendations.push('Add special characters (!@#$%^&*)');
    }
    if (!checks.notCommonPattern) {
      recommendations.push('Avoid common patterns (e.g., "password123")');
    }

    if (recommendations.length === 0) {
      recommendations.push('Password meets strength requirements');
    }

    return recommendations;
  }

  /**
   * Calculate overall security score
   * @param {Object} breachResult - Breach check result
   * @param {Object} strengthResult - Strength check result
   * @returns {Object} Overall security assessment
   */
  calculateOverallSecurity(breachResult, strengthResult) {
    let score = 0;
    let status = 'unsafe';

    // Start with strength score (0-60 points)
    const [strengthScore, maxStrengthScore] = strengthResult.score.split('/').map(Number);
    score += (strengthScore / maxStrengthScore) * 60;

    // Add points for not being breached (40 points)
    if (!breachResult.isBreached) {
      score += 40;
    } else {
      // Deduct points based on breach severity
      if (breachResult.severity === 'critical') score -= 20;
      else if (breachResult.severity === 'high') score -= 10;
      else if (breachResult.severity === 'medium') score -= 5;
    }

    // Determine status
    if (score >= 80) status = 'excellent';
    else if (score >= 60) status = 'good';
    else if (score >= 40) status = 'fair';
    else status = 'poor';

    return {
      score: Math.round(score),
      status,
      recommendation: this.getOverallRecommendation(score, breachResult.isBreached)
    };
  }

  /**
   * Get overall security recommendation
   * @param {number} score - Overall security score
   * @param {boolean} isBreached - Whether password is breached
   * @returns {string} Recommendation message
   */
  getOverallRecommendation(score, isBreached) {
    if (isBreached) {
      return '🚨 This password has been compromised. Change it immediately!';
    }
    if (score >= 80) {
      return '✅ Excellent password! Keep it secure and don\'t reuse it.';
    }
    if (score >= 60) {
      return '👍 Good password, but there\'s room for improvement.';
    }
    if (score >= 40) {
      return '⚠️  Fair password. Consider making it stronger.';
    }
    return '❌ Weak password. Please create a stronger one.';
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 16)
   * @param {Object} options - Password generation options
   * @returns {string} Generated password
   */
  generateSecurePassword(length = 16, options = {}) {
    const {
      includeUpperCase = true,
      includeLowerCase = true,
      includeNumbers = true,
      includeSpecialChars = true
    } = options;

    let charset = '';
    if (includeUpperCase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowerCase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSpecialChars) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (charset.length === 0) {
      throw new Error('At least one character type must be included');
    }

    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      const randomIndex = randomBytes[i] % charset.length;
      password += charset[randomIndex];
    }

    return password;
  }
}

module.exports = { PasswordBreachChecker };
