const { logger } = require('../utils/logger');
const { AuditLogger } = require('../utils/audit-logger');
const chalk = require('chalk');
const Table = require('cli-table3');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');

class AuditCommands {
  constructor() {
    this.logger = logger;
    this.auditLogger = new AuditLogger();
  }

  /**
   * Display audit logs with filtering options
   */
  async viewLogs(options = {}) {
    try {
      this.logger.info('📋 Fetching audit logs...\n');

      // Build filters from options
      const filters = {};

      if (options.action) filters.action = options.action;
      if (options.category) filters.category = options.category;
      if (options.severity) filters.severity = options.severity;
      if (options.user) filters.user = options.user;
      if (options.failed) filters.failedOnly = true;
      if (options.limit) filters.limit = parseInt(options.limit);

      // Handle date filters
      if (options.since) {
        filters.startDate = this.parseDate(options.since);
      }
      if (options.until) {
        filters.endDate = this.parseDate(options.until);
      }

      // Query logs
      const entries = await this.auditLogger.query(filters);

      if (entries.length === 0) {
        this.logger.info('No audit log entries found matching the criteria.');
        return;
      }

      // Display results
      if (options.format === 'json') {
        console.log(JSON.stringify(entries, null, 2));
      } else if (options.format === 'csv') {
        this.displayAsCSV(entries);
      } else {
        this.displayAsTable(entries, options);
      }

      this.logger.info(`\n📊 Total entries: ${entries.length}`);

    } catch (error) {
      this.logger.error('Failed to view audit logs:', error.message);
      throw error;
    }
  }

  /**
   * Display audit statistics
   */
  async showStatistics() {
    try {
      this.logger.info('📊 Audit Log Statistics\n');

      const stats = await this.auditLogger.getStatistics();

      console.log(chalk.bold('Overview:'));
      console.log(`  Total Events: ${chalk.cyan(stats.totalEvents)}`);
      console.log(`  Failed Events: ${chalk.red(stats.failedEvents)}`);
      console.log(`  Success Rate: ${chalk.green(((stats.totalEvents - stats.failedEvents) / stats.totalEvents * 100).toFixed(2))}%\n`);

      console.log(chalk.bold('Activity by Time Period:'));
      console.log(`  Last 24 Hours: ${chalk.cyan(stats.last24Hours)} events`);
      console.log(`  Last 7 Days: ${chalk.cyan(stats.last7Days)} events`);
      console.log(`  Last 30 Days: ${chalk.cyan(stats.last30Days)} events\n`);

      // Display by category
      console.log(chalk.bold('Events by Category:'));
      const categoryTable = new Table({
        head: ['Category', 'Count', 'Percentage'],
        colWidths: [30, 15, 15]
      });

      Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, count]) => {
          const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
          categoryTable.push([category, count, `${percentage}%`]);
        });

      console.log(categoryTable.toString());
      console.log();

      // Display by severity
      console.log(chalk.bold('Events by Severity:'));
      const severityTable = new Table({
        head: ['Severity', 'Count', 'Percentage'],
        colWidths: [30, 15, 15]
      });

      Object.entries(stats.bySeverity)
        .sort((a, b) => b[1] - a[1])
        .forEach(([severity, count]) => {
          const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
          const coloredSeverity = this.colorSeverity(severity);
          severityTable.push([coloredSeverity, count, `${percentage}%`]);
        });

      console.log(severityTable.toString());
      console.log();

      // Display top actions
      console.log(chalk.bold('Top 10 Actions:'));
      const actionTable = new Table({
        head: ['Action', 'Count'],
        colWidths: [40, 15]
      });

      Object.entries(stats.byAction)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([action, count]) => {
          actionTable.push([action, count]);
        });

      console.log(actionTable.toString());

    } catch (error) {
      this.logger.error('Failed to show statistics:', error.message);
      throw error;
    }
  }

  /**
   * Interactive audit log viewer
   */
  async interactiveView() {
    try {
      let continueViewing = true;

      while (continueViewing) {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to view?',
          choices: [
            { name: '📊 Statistics Overview', value: 'stats' },
            { name: '📋 All Recent Logs (last 50)', value: 'recent' },
            { name: '❌ Failed Actions Only', value: 'failed' },
            { name: '🔐 Authentication Events', value: 'auth' },
            { name: '🚀 Deployment Events', value: 'deploy' },
            { name: '⚙️  Configuration Changes', value: 'config' },
            { name: '🔍 Custom Filter', value: 'custom' },
            { name: '💾 Export Logs', value: 'export' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }]);

        switch (action) {
          case 'stats':
            await this.showStatistics();
            break;

          case 'recent':
            await this.viewLogs({ limit: 50 });
            break;

          case 'failed':
            await this.viewLogs({ failed: true, limit: 50 });
            break;

          case 'auth':
            await this.viewLogs({ category: 'authentication', limit: 50 });
            break;

          case 'deploy':
            await this.viewLogs({ category: 'deployment', limit: 50 });
            break;

          case 'config':
            await this.viewLogs({ category: 'configuration', limit: 50 });
            break;

          case 'custom':
            await this.customFilter();
            break;

          case 'export':
            await this.exportLogs();
            break;

          case 'exit':
            continueViewing = false;
            break;
        }

        if (continueViewing) {
          const { continue: shouldContinue } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continue',
            message: 'View more logs?',
            default: true
          }]);
          continueViewing = shouldContinue;
        }
      }

      this.logger.info('👋 Audit log viewer closed');

    } catch (error) {
      this.logger.error('Interactive view failed:', error.message);
      throw error;
    }
  }

  /**
   * Custom filter builder
   */
  async customFilter() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'severity',
        message: 'Filter by severity:',
        choices: ['All', 'info', 'warning', 'critical']
      },
      {
        type: 'list',
        name: 'category',
        message: 'Filter by category:',
        choices: ['All', 'authentication', 'deployment', 'configuration', 'security', 'infrastructure']
      },
      {
        type: 'input',
        name: 'days',
        message: 'Show logs from last N days (leave empty for all):',
        validate: (input) => {
          if (!input) return true;
          const num = parseInt(input);
          return !isNaN(num) && num > 0 || 'Please enter a positive number';
        }
      },
      {
        type: 'input',
        name: 'limit',
        message: 'Maximum number of results:',
        default: '50',
        validate: (input) => {
          const num = parseInt(input);
          return !isNaN(num) && num > 0 || 'Please enter a positive number';
        }
      }
    ]);

    const filters = {};
    if (answers.severity !== 'All') filters.severity = answers.severity;
    if (answers.category !== 'All') filters.category = answers.category;
    if (answers.days) {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(answers.days));
      filters.startDate = date;
    }
    filters.limit = parseInt(answers.limit);

    await this.viewLogs(filters);
  }

  /**
   * Export audit logs
   */
  async exportLogs() {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'filename',
          message: 'Export filename:',
          default: `audit-logs-${new Date().toISOString().split('T')[0]}.json`
        },
        {
          type: 'list',
          name: 'timeRange',
          message: 'Time range:',
          choices: ['All', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'Custom']
        }
      ]);

      const filters = {};

      if (answers.timeRange !== 'All') {
        const now = new Date();
        let daysAgo;

        switch (answers.timeRange) {
          case 'Last 24 hours':
            filters.startDate = new Date(now - 24 * 60 * 60 * 1000);
            break;
          case 'Last 7 days':
            filters.startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'Last 30 days':
            filters.startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'Custom':
            const { days } = await inquirer.prompt([{
              type: 'input',
              name: 'days',
              message: 'Number of days to export:',
              validate: (input) => !isNaN(parseInt(input)) && parseInt(input) > 0
            }]);
            filters.startDate = new Date(now - parseInt(days) * 24 * 60 * 60 * 1000);
            break;
        }
      }

      const outputPath = path.join(process.cwd(), answers.filename);
      await this.auditLogger.export(outputPath, filters);

      this.logger.info(`✅ Audit logs exported to: ${chalk.cyan(outputPath)}`);

    } catch (error) {
      this.logger.error('Failed to export logs:', error.message);
      throw error;
    }
  }

  /**
   * Display entries as a table
   */
  displayAsTable(entries, options = {}) {
    const table = new Table({
      head: ['Time', 'Action', 'User', 'Status', 'Details'],
      colWidths: [20, 25, 15, 10, 40],
      wordWrap: true
    });

    entries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleString();
      const status = entry.success ? chalk.green('✓') : chalk.red('✗');
      const details = this.formatDetails(entry);

      table.push([
        time,
        this.colorAction(entry.action, entry.category),
        entry.user,
        status,
        details
      ]);
    });

    console.log(table.toString());
  }

  /**
   * Display entries as CSV
   */
  displayAsCSV(entries) {
    // Header
    console.log('Timestamp,Action,Category,Severity,User,Success,Details');

    // Rows
    entries.forEach(entry => {
      const details = JSON.stringify(entry.details).replace(/"/g, '""');
      console.log(
        `"${entry.timestamp}","${entry.action}","${entry.category}","${entry.severity}","${entry.user}",${entry.success},"${details}"`
      );
    });
  }

  /**
   * Format entry details for display
   */
  formatDetails(entry) {
    const details = [];

    if (entry.error) {
      details.push(chalk.red(`Error: ${entry.error}`));
    }

    if (entry.details) {
      Object.entries(entry.details).forEach(([key, value]) => {
        if (value && typeof value !== 'object') {
          details.push(`${key}: ${value}`);
        }
      });
    }

    return details.join(', ') || '-';
  }

  /**
   * Color action based on category
   */
  colorAction(action, category) {
    switch (category) {
      case 'authentication':
        return chalk.blue(action);
      case 'deployment':
        return chalk.green(action);
      case 'security':
        return chalk.yellow(action);
      case 'configuration':
        return chalk.magenta(action);
      case 'infrastructure':
        return chalk.cyan(action);
      default:
        return action;
    }
  }

  /**
   * Color severity level
   */
  colorSeverity(severity) {
    switch (severity) {
      case 'critical':
        return chalk.red.bold(severity);
      case 'warning':
        return chalk.yellow(severity);
      case 'info':
        return chalk.green(severity);
      default:
        return severity;
    }
  }

  /**
   * Parse date string
   */
  parseDate(dateStr) {
    // Handle formats like "2024-01-01", "7d", "24h"
    if (dateStr.match(/^\d+d$/)) {
      const days = parseInt(dateStr);
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    }

    if (dateStr.match(/^\d+h$/)) {
      const hours = parseInt(dateStr);
      return new Date(Date.now() - hours * 60 * 60 * 1000);
    }

    return new Date(dateStr);
  }

  /**
   * Clear audit logs (with confirmation)
   */
  async clearLogs() {
    try {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('⚠️  Are you sure you want to clear ALL audit logs? This cannot be undone!'),
        default: false
      }]);

      if (!confirm) {
        this.logger.info('Operation cancelled');
        return;
      }

      const { doubleConfirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'doubleConfirm',
        message: chalk.red('⚠️  FINAL WARNING: This will permanently delete all audit history. Continue?'),
        default: false
      }]);

      if (!doubleConfirm) {
        this.logger.info('Operation cancelled');
        return;
      }

      // Export backup before clearing
      const backupPath = path.join(process.cwd(), `audit-logs-backup-${Date.now()}.json`);
      await this.auditLogger.export(backupPath);
      this.logger.info(`📦 Backup saved to: ${chalk.cyan(backupPath)}`);

      // Clear logs
      await this.auditLogger.clear();
      this.logger.info('✅ Audit logs cleared successfully');

    } catch (error) {
      this.logger.error('Failed to clear logs:', error.message);
      throw error;
    }
  }
}

module.exports = AuditCommands;
