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

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { logger } = require('../utils/logger');
const { getUsageLimits, isWithinLimits } = require('./license-tiers');

/**
 * Usage Tracker for Focal Deploy SaaS
 *
 * Tracks API calls, deployments, and resource usage
 * for billing and limit enforcement
 */
class UsageTracker {
  constructor(apiClient = null) {
    this.usagePath = path.join(os.homedir(), '.focal-deploy', 'usage.json');
    this.apiClient = apiClient; // For syncing with SaaS API
  }

  /**
   * Initialize usage tracking
   */
  async initialize() {
    await fs.ensureDir(path.dirname(this.usagePath));

    if (!await fs.pathExists(this.usagePath)) {
      await this.resetUsage();
    }
  }

  /**
   * Reset usage (monthly reset)
   */
  async resetUsage() {
    const usage = {
      version: '1.0',
      resetAt: new Date().toISOString(),
      period: {
        start: new Date().toISOString(),
        end: this.getEndOfMonth().toISOString()
      },
      deployments: {
        count: 0,
        successful: 0,
        failed: 0,
        history: []
      },
      apiCalls: {
        total: 0,
        byEndpoint: {},
        byDay: {}
      },
      resources: {
        instances: 0,
        s3Buckets: 0,
        domains: 0
      },
      costs: {
        estimated: 0,
        awsCharges: 0,
        subscriptionFee: 0
      },
      lastSync: null
    };

    await fs.writeJson(this.usagePath, usage, { spaces: 2 });
    return usage;
  }

  /**
   * Load current usage
   */
  async loadUsage() {
    try {
      if (!await fs.pathExists(this.usagePath)) {
        return await this.resetUsage();
      }

      const usage = await fs.readJson(this.usagePath);

      // Check if we need to reset (new month)
      if (this.shouldReset(usage)) {
        logger.debug('Monthly usage reset triggered');
        return await this.resetUsage();
      }

      return usage;
    } catch (error) {
      logger.error(`Failed to load usage: ${error.message}`);
      return await this.resetUsage();
    }
  }

  /**
   * Save usage data
   */
  async saveUsage(usage) {
    await fs.writeJson(this.usagePath, usage, { spaces: 2 });
  }

  /**
   * Check if usage should reset
   */
  shouldReset(usage) {
    const now = new Date();
    const periodEnd = new Date(usage.period.end);
    return now > periodEnd;
  }

  /**
   * Get end of current month
   */
  getEndOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  /**
   * Track a deployment
   */
  async trackDeployment(deploymentData) {
    const usage = await this.loadUsage();

    usage.deployments.count++;

    if (deploymentData.success) {
      usage.deployments.successful++;
    } else {
      usage.deployments.failed++;
    }

    usage.deployments.history.push({
      timestamp: new Date().toISOString(),
      projectName: deploymentData.projectName,
      instanceType: deploymentData.instanceType,
      region: deploymentData.region,
      success: deploymentData.success,
      duration: deploymentData.duration,
      cost: deploymentData.estimatedCost || 0
    });

    // Keep only last 100 deployments in history
    if (usage.deployments.history.length > 100) {
      usage.deployments.history = usage.deployments.history.slice(-100);
    }

    await this.saveUsage(usage);
    await this.syncWithAPI('deployment', deploymentData);

    return usage;
  }

  /**
   * Track an API call
   */
  async trackAPICall(endpoint, method = 'GET') {
    const usage = await this.loadUsage();

    usage.apiCalls.total++;

    // Track by endpoint
    const endpointKey = `${method} ${endpoint}`;
    usage.apiCalls.byEndpoint[endpointKey] = (usage.apiCalls.byEndpoint[endpointKey] || 0) + 1;

    // Track by day
    const today = new Date().toISOString().split('T')[0];
    usage.apiCalls.byDay[today] = (usage.apiCalls.byDay[today] || 0) + 1;

    await this.saveUsage(usage);

    // Sync every 100 calls
    if (usage.apiCalls.total % 100 === 0) {
      await this.syncWithAPI('api_calls', usage.apiCalls);
    }

    return usage;
  }

  /**
   * Update resource count
   */
  async updateResources(resourceType, count) {
    const usage = await this.loadUsage();

    usage.resources[resourceType] = count;

    await this.saveUsage(usage);
    await this.syncWithAPI('resources', usage.resources);

    return usage;
  }

  /**
   * Update cost estimate
   */
  async updateCosts(costs) {
    const usage = await this.loadUsage();

    usage.costs = {
      ...usage.costs,
      ...costs,
      lastUpdated: new Date().toISOString()
    };

    await this.saveUsage(usage);
    await this.syncWithAPI('costs', usage.costs);

    return usage;
  }

  /**
   * Check if user is within limits
   */
  async checkLimits(licenseTier) {
    const usage = await this.loadUsage();
    const limits = getUsageLimits(licenseTier);

    const checks = {
      deployments: {
        withinLimit: isWithinLimits(licenseTier, 'deploymentsPerMonth', usage.deployments.count),
        current: usage.deployments.count,
        limit: limits.deploymentsPerMonth,
        percentage: limits.deploymentsPerMonth > 0
          ? (usage.deployments.count / limits.deploymentsPerMonth) * 100
          : 0
      },
      apiCalls: {
        withinLimit: isWithinLimits(licenseTier, 'apiCallsPerDay', usage.apiCalls.byDay[this.getToday()] || 0),
        current: usage.apiCalls.byDay[this.getToday()] || 0,
        limit: limits.apiCallsPerDay,
        percentage: limits.apiCallsPerDay > 0
          ? ((usage.apiCalls.byDay[this.getToday()] || 0) / limits.apiCallsPerDay) * 100
          : 0
      },
      instances: {
        withinLimit: isWithinLimits(licenseTier, 'maxInstances', usage.resources.instances),
        current: usage.resources.instances,
        limit: limits.maxInstances,
        percentage: limits.maxInstances > 0
          ? (usage.resources.instances / limits.maxInstances) * 100
          : 0
      }
    };

    return checks;
  }

  /**
   * Get current usage summary
   */
  async getUsageSummary() {
    const usage = await this.loadUsage();

    return {
      period: usage.period,
      deployments: {
        total: usage.deployments.count,
        successful: usage.deployments.successful,
        failed: usage.deployments.failed,
        successRate: usage.deployments.count > 0
          ? ((usage.deployments.successful / usage.deployments.count) * 100).toFixed(1)
          : '0'
      },
      apiCalls: {
        total: usage.apiCalls.total,
        today: usage.apiCalls.byDay[this.getToday()] || 0,
        averagePerDay: this.calculateAveragePerDay(usage.apiCalls.byDay)
      },
      resources: usage.resources,
      costs: usage.costs
    };
  }

  /**
   * Get today's date string
   */
  getToday() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Calculate average API calls per day
   */
  calculateAveragePerDay(byDay) {
    const days = Object.keys(byDay);
    if (days.length === 0) return 0;

    const total = Object.values(byDay).reduce((sum, count) => sum + count, 0);
    return Math.round(total / days.length);
  }

  /**
   * Sync with SaaS API
   */
  async syncWithAPI(eventType, data) {
    if (!this.apiClient) {
      logger.debug('No API client configured, skipping sync');
      return;
    }

    try {
      await this.apiClient.post('/usage/track', {
        eventType,
        data,
        timestamp: new Date().toISOString()
      });

      const usage = await this.loadUsage();
      usage.lastSync = new Date().toISOString();
      await this.saveUsage(usage);

      logger.debug(`Usage synced with API: ${eventType}`);
    } catch (error) {
      logger.debug(`Failed to sync usage with API: ${error.message}`);
      // Don't throw - local tracking continues
    }
  }

  /**
   * Export usage data
   */
  async exportUsage(outputPath, format = 'json') {
    const usage = await this.loadUsage();

    if (format === 'json') {
      await fs.writeJson(outputPath, usage, { spaces: 2 });
    } else if (format === 'csv') {
      const csv = this.convertToCSV(usage);
      await fs.writeFile(outputPath, csv);
    }

    logger.info(`Usage data exported to: ${outputPath}`);
  }

  /**
   * Convert usage to CSV
   */
  convertToCSV(usage) {
    let csv = 'Date,Deployments,API Calls,Instances,S3 Buckets,Domains,Estimated Cost\n';

    // Add daily breakdown
    const dates = Object.keys(usage.apiCalls.byDay).sort();
    dates.forEach(date => {
      const apiCalls = usage.apiCalls.byDay[date];
      csv += `${date},0,${apiCalls},${usage.resources.instances},${usage.resources.s3Buckets},${usage.resources.domains},0\n`;
    });

    return csv;
  }

  /**
   * Get usage analytics
   */
  async getAnalytics() {
    const usage = await this.loadUsage();

    return {
      trends: {
        deploymentTrend: this.calculateTrend(usage.deployments.history),
        apiCallTrend: this.calculateAPICallTrend(usage.apiCalls.byDay)
      },
      topEndpoints: this.getTopEndpoints(usage.apiCalls.byEndpoint, 10),
      recentDeployments: usage.deployments.history.slice(-10).reverse(),
      costProjection: this.projectMonthlyCost(usage)
    };
  }

  /**
   * Calculate deployment trend
   */
  calculateTrend(history) {
    if (history.length < 2) return 'stable';

    const recent = history.slice(-7); // Last 7 deployments
    const previous = history.slice(-14, -7); // 7 before that

    const recentAvg = recent.length;
    const previousAvg = previous.length;

    if (recentAvg > previousAvg * 1.2) return 'increasing';
    if (recentAvg < previousAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate API call trend
   */
  calculateAPICallTrend(byDay) {
    const dates = Object.keys(byDay).sort().slice(-7);
    if (dates.length < 2) return 'stable';

    const counts = dates.map(date => byDay[date]);
    const avgFirst = counts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const avgLast = counts.slice(-3).reduce((a, b) => a + b, 0) / 3;

    if (avgLast > avgFirst * 1.2) return 'increasing';
    if (avgLast < avgFirst * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Get top API endpoints
   */
  getTopEndpoints(byEndpoint, limit = 10) {
    return Object.entries(byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  /**
   * Project monthly cost
   */
  projectMonthlyCost(usage) {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysPassed = new Date().getDate();
    const dailyAvg = usage.costs.estimated / daysPassed;

    return {
      currentCost: usage.costs.estimated,
      projectedCost: dailyAvg * daysInMonth,
      daysRemaining: daysInMonth - daysPassed
    };
  }
}

module.exports = { UsageTracker };
