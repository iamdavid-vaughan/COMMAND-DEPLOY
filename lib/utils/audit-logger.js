const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { logger } = require('./logger');
const crypto = require('crypto');

/**
 * AuditLogger - Track sensitive security actions
 *
 * Tracks and logs sensitive actions including:
 * - Login attempts (SSH, API)
 * - Password changes
 * - Credential access
 * - Deployments
 * - Security configuration changes
 * - Resource creation/deletion
 */
class AuditLogger {
  constructor(options = {}) {
    this.logger = logger;
    this.auditLogPath = options.logPath || path.join(process.cwd(), '.focal-deploy-audit.json');
    this.maxLogEntries = options.maxLogEntries || 10000;
    this.retentionDays = options.retentionDays || 90;
  }

  /**
   * Initialize audit log file if it doesn't exist
   */
  async initialize() {
    try {
      if (!await fs.pathExists(this.auditLogPath)) {
        await fs.writeJson(this.auditLogPath, {
          version: '1.0',
          created: new Date().toISOString(),
          entries: []
        }, { spaces: 2 });
        this.logger.info('Audit log initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize audit log:', error.message);
      throw error;
    }
  }

  /**
   * Log a security event
   * @param {Object} event - Event details
   * @param {string} event.action - Action type (e.g., 'login', 'deployment', 'password_change')
   * @param {string} event.category - Category (e.g., 'authentication', 'deployment', 'configuration')
   * @param {string} event.severity - Severity level ('info', 'warning', 'critical')
   * @param {Object} event.details - Additional event details
   * @param {string} event.user - User or system that triggered the action
   * @param {string} event.ipAddress - IP address (if applicable)
   * @param {boolean} event.success - Whether the action succeeded
   * @param {string} event.error - Error message (if action failed)
   */
  async logEvent(event) {
    try {
      await this.initialize();

      const auditEntry = {
        id: crypto.randomBytes(16).toString('hex'),
        timestamp: new Date().toISOString(),
        action: event.action,
        category: event.category || 'general',
        severity: event.severity || 'info',
        success: event.success !== false,
        user: event.user || process.env.USER || os.userInfo().username,
        hostname: os.hostname(),
        ipAddress: event.ipAddress || null,
        details: event.details || {},
        error: event.error || null,
        metadata: {
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch()
        }
      };

      // Read existing log
      const auditLog = await fs.readJson(this.auditLogPath);

      // Add new entry
      auditLog.entries.push(auditEntry);

      // Rotate if needed
      await this.rotateIfNeeded(auditLog);

      // Write back to file
      await fs.writeJson(this.auditLogPath, auditLog, { spaces: 2 });

      // Log to console for critical events
      if (event.severity === 'critical' || !event.success) {
        this.logger.warn(`🔐 AUDIT: ${event.action} - ${event.success ? 'SUCCESS' : 'FAILED'}`);
      }

      return auditEntry;
    } catch (error) {
      this.logger.error('Failed to log audit event:', error.message);
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Log SSH login attempt
   */
  async logSSHLogin(details) {
    return await this.logEvent({
      action: 'ssh_login',
      category: 'authentication',
      severity: details.success ? 'info' : 'warning',
      success: details.success,
      user: details.user,
      ipAddress: details.ipAddress,
      details: {
        instanceId: details.instanceId,
        port: details.port,
        publicKey: details.publicKey ? 'used' : 'not_used'
      },
      error: details.error
    });
  }

  /**
   * Log API authentication attempt
   */
  async logAPIAuth(details) {
    return await this.logEvent({
      action: 'api_authentication',
      category: 'authentication',
      severity: details.success ? 'info' : 'warning',
      success: details.success,
      user: details.user,
      ipAddress: details.ipAddress,
      details: {
        provider: details.provider, // 'aws', 'github', 'dns_provider'
        operation: details.operation
      },
      error: details.error
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(details) {
    return await this.logEvent({
      action: 'password_change',
      category: 'authentication',
      severity: 'warning',
      success: details.success,
      user: details.user,
      details: {
        target: details.target, // 'system', 'database', 'service'
        method: details.method, // 'manual', 'automated'
        compromised: details.compromised || false
      },
      error: details.error
    });
  }

  /**
   * Log credential access
   */
  async logCredentialAccess(details) {
    return await this.logEvent({
      action: 'credential_access',
      category: 'security',
      severity: 'warning',
      success: details.success,
      user: details.user,
      details: {
        credentialType: details.credentialType, // 'aws', 'ssh_key', 'api_token'
        operation: details.operation, // 'read', 'write', 'delete'
        resource: details.resource
      },
      error: details.error
    });
  }

  /**
   * Log deployment action
   */
  async logDeployment(details) {
    return await this.logEvent({
      action: 'deployment',
      category: 'deployment',
      severity: details.success ? 'info' : 'critical',
      success: details.success,
      user: details.user,
      details: {
        environment: details.environment, // 'production', 'staging', 'development'
        instanceId: details.instanceId,
        applicationName: details.applicationName,
        version: details.version,
        duration: details.duration
      },
      error: details.error
    });
  }

  /**
   * Log security configuration change
   */
  async logSecurityConfig(details) {
    return await this.logEvent({
      action: 'security_configuration',
      category: 'configuration',
      severity: 'warning',
      success: details.success,
      user: details.user,
      details: {
        configType: details.configType, // 'firewall', 'ssh', 'ssl', 'fail2ban'
        changes: details.changes,
        previousValue: details.previousValue,
        newValue: details.newValue
      },
      error: details.error
    });
  }

  /**
   * Log resource creation
   */
  async logResourceCreation(details) {
    return await this.logEvent({
      action: 'resource_creation',
      category: 'infrastructure',
      severity: 'info',
      success: details.success,
      user: details.user,
      details: {
        resourceType: details.resourceType, // 'ec2', 's3', 'security_group', etc.
        resourceId: details.resourceId,
        resourceName: details.resourceName,
        region: details.region
      },
      error: details.error
    });
  }

  /**
   * Log resource deletion
   */
  async logResourceDeletion(details) {
    return await this.logEvent({
      action: 'resource_deletion',
      category: 'infrastructure',
      severity: 'warning',
      success: details.success,
      user: details.user,
      details: {
        resourceType: details.resourceType,
        resourceId: details.resourceId,
        resourceName: details.resourceName,
        region: details.region
      },
      error: details.error
    });
  }

  /**
   * Query audit logs
   * @param {Object} filters - Query filters
   * @param {string} filters.action - Filter by action type
   * @param {string} filters.category - Filter by category
   * @param {string} filters.severity - Filter by severity
   * @param {string} filters.user - Filter by user
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {boolean} filters.failedOnly - Show only failed actions
   * @param {number} filters.limit - Limit number of results
   */
  async query(filters = {}) {
    try {
      await this.initialize();

      const auditLog = await fs.readJson(this.auditLogPath);
      let entries = auditLog.entries;

      // Apply filters
      if (filters.action) {
        entries = entries.filter(e => e.action === filters.action);
      }

      if (filters.category) {
        entries = entries.filter(e => e.category === filters.category);
      }

      if (filters.severity) {
        entries = entries.filter(e => e.severity === filters.severity);
      }

      if (filters.user) {
        entries = entries.filter(e => e.user === filters.user);
      }

      if (filters.startDate) {
        entries = entries.filter(e => new Date(e.timestamp) >= filters.startDate);
      }

      if (filters.endDate) {
        entries = entries.filter(e => new Date(e.timestamp) <= filters.endDate);
      }

      if (filters.failedOnly) {
        entries = entries.filter(e => !e.success);
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply limit
      if (filters.limit) {
        entries = entries.slice(0, filters.limit);
      }

      return entries;
    } catch (error) {
      this.logger.error('Failed to query audit logs:', error.message);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics() {
    try {
      await this.initialize();

      const auditLog = await fs.readJson(this.auditLogPath);
      const entries = auditLog.entries;

      const stats = {
        totalEvents: entries.length,
        byCategory: {},
        bySeverity: {},
        byAction: {},
        failedEvents: entries.filter(e => !e.success).length,
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0
      };

      const now = new Date();
      const day24ago = new Date(now - 24 * 60 * 60 * 1000);
      const days7ago = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const days30ago = new Date(now - 30 * 24 * 60 * 60 * 1000);

      entries.forEach(entry => {
        // Count by category
        stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;

        // Count by severity
        stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;

        // Count by action
        stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;

        // Count by time period
        const entryDate = new Date(entry.timestamp);
        if (entryDate >= day24ago) stats.last24Hours++;
        if (entryDate >= days7ago) stats.last7Days++;
        if (entryDate >= days30ago) stats.last30Days++;
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to get audit statistics:', error.message);
      throw error;
    }
  }

  /**
   * Rotate log entries if needed
   */
  async rotateIfNeeded(auditLog) {
    // Remove entries older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    auditLog.entries = auditLog.entries.filter(entry => {
      return new Date(entry.timestamp) >= cutoffDate;
    });

    // Limit total entries
    if (auditLog.entries.length > this.maxLogEntries) {
      // Keep only the most recent entries
      auditLog.entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      auditLog.entries = auditLog.entries.slice(0, this.maxLogEntries);
    }
  }

  /**
   * Export audit logs to a file
   */
  async export(outputPath, filters = {}) {
    try {
      const entries = await this.query(filters);

      await fs.writeJson(outputPath, {
        exportDate: new Date().toISOString(),
        filters: filters,
        entries: entries
      }, { spaces: 2 });

      this.logger.info(`Audit logs exported to ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('Failed to export audit logs:', error.message);
      throw error;
    }
  }

  /**
   * Clear all audit logs (use with caution!)
   */
  async clear() {
    try {
      await fs.writeJson(this.auditLogPath, {
        version: '1.0',
        created: new Date().toISOString(),
        entries: []
      }, { spaces: 2 });

      this.logger.info('Audit logs cleared');
    } catch (error) {
      this.logger.error('Failed to clear audit logs:', error.message);
      throw error;
    }
  }
}

module.exports = { AuditLogger };
