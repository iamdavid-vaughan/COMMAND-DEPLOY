const { AuditLogger } = require('./audit-logger');

/**
 * AuditIntegration - Helper functions to integrate audit logging into existing commands
 *
 * This module provides wrapper functions that can be used throughout the application
 * to automatically log security-sensitive operations.
 */

class AuditIntegration {
  constructor() {
    this.auditLogger = new AuditLogger();
  }

  /**
   * Wrap an async function with audit logging
   * @param {string} action - Action name
   * @param {string} category - Category
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Additional options
   */
  async withAuditLog(action, category, fn, options = {}) {
    const startTime = Date.now();
    let success = false;
    let error = null;
    let result = null;

    try {
      result = await fn();
      success = true;
      return result;
    } catch (err) {
      error = err.message;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      await this.auditLogger.logEvent({
        action,
        category,
        severity: options.severity || (success ? 'info' : 'warning'),
        success,
        user: options.user,
        ipAddress: options.ipAddress,
        details: {
          ...options.details,
          duration
        },
        error
      });
    }
  }

  /**
   * Log SSH connection attempt
   */
  async logSSHConnection(instanceId, user, success, error = null, options = {}) {
    return await this.auditLogger.logSSHLogin({
      instanceId,
      user,
      success,
      error,
      ipAddress: options.ipAddress,
      port: options.port || 22,
      publicKey: options.publicKey
    });
  }

  /**
   * Log deployment action
   */
  async logDeployment(details) {
    return await this.auditLogger.logDeployment(details);
  }

  /**
   * Log credential access
   */
  async logCredentialAccess(credentialType, operation, success, details = {}) {
    return await this.auditLogger.logCredentialAccess({
      credentialType,
      operation,
      success,
      ...details
    });
  }

  /**
   * Log security configuration change
   */
  async logSecurityConfigChange(configType, changes, success, details = {}) {
    return await this.auditLogger.logSecurityConfig({
      configType,
      changes,
      success,
      ...details
    });
  }

  /**
   * Log resource creation
   */
  async logResourceCreation(resourceType, resourceId, resourceName, success, details = {}) {
    return await this.auditLogger.logResourceCreation({
      resourceType,
      resourceId,
      resourceName,
      success,
      ...details
    });
  }

  /**
   * Log resource deletion
   */
  async logResourceDeletion(resourceType, resourceId, resourceName, success, details = {}) {
    return await this.auditLogger.logResourceDeletion({
      resourceType,
      resourceId,
      resourceName,
      success,
      ...details
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(target, method, success, compromised = false, details = {}) {
    return await this.auditLogger.logPasswordChange({
      target,
      method,
      success,
      compromised,
      ...details
    });
  }

  /**
   * Log API authentication
   */
  async logAPIAuthentication(provider, operation, success, error = null, details = {}) {
    return await this.auditLogger.logAPIAuth({
      provider,
      operation,
      success,
      error,
      ...details
    });
  }
}

// Create a singleton instance
const auditIntegration = new AuditIntegration();

module.exports = { AuditIntegration, auditIntegration };
