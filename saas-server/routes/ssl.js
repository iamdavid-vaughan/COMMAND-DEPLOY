/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * SSL Certificate Management Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const { checkSSLCertificate } = require('../services/sslChecker');
const logger = require('../utils/logger');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * GET /api/ssl/certificates
 * Get all SSL certificates for user's deployments
 */
router.get('/certificates', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();

    // Get all deployments with domains for this user
    const deployments = await Deployment.findAll({
      where: {
        user_id: req.user.userId
      },
      attributes: ['id', 'project_name', 'domains', 'configuration']
    });

    // Filter deployments that have domains configured
    const deploymentsWithDomains = deployments.filter(d =>
      d.domains && Array.isArray(d.domains) && d.domains.length > 0
    );

    // Check SSL for each deployment
    const certificates = await Promise.all(
      deploymentsWithDomains.map(async (deployment) => {
        const domain = deployment.domains[0]; // Use first domain
        const sslConfig = deployment.configuration?.ssl || {};
        const useStaging = sslConfig.useStaging || false;

        let sslInfo = {
          valid: false,
          issuer: 'Unknown',
          validFrom: new Date(),
          validTo: new Date(),
          daysUntilExpiry: 0
        };

        if (domain) {
          try {
            const sslCheck = await checkSSLCertificate(domain);
            if (sslCheck.valid !== false) {
              sslInfo = {
                valid: sslCheck.valid,
                issuer: sslCheck.issuer || 'Unknown',
                validFrom: sslCheck.validFrom,
                validTo: sslCheck.validTo,
                daysUntilExpiry: sslCheck.daysUntilExpiry
              };
            }
          } catch (error) {
            logger.error('SSL check failed', { domain, error: error.message });
          }
        }

        return {
          deployment_id: deployment.id,
          deployment_name: deployment.project_name || `Deployment ${deployment.id}`,
          domain,
          valid: sslInfo.valid,
          issuer: sslInfo.issuer,
          validFrom: sslInfo.validFrom,
          validTo: sslInfo.validTo,
          daysUntilExpiry: sslInfo.daysUntilExpiry,
          autoRenew: sslConfig.enabled || false,
          useStaging
        };
      })
    );

    res.json({
      success: true,
      certificates
    });
  } catch (error) {
    logger.error('Failed to fetch SSL certificates', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SSL certificates',
      error: error.message
    });
  }
});

/**
 * GET /api/ssl/certificates/:deploymentId
 * Get SSL certificate for a specific deployment
 */
router.get('/certificates/:deploymentId', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = req.params.deploymentId;

    // Verify ownership
    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      },
      attributes: ['id', 'project_name', 'domains', 'configuration']
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    const domain = deployment.domains && deployment.domains[0];
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Deployment has no domain configured'
      });
    }

    const sslConfig = deployment.configuration?.ssl || {};
    const useStaging = sslConfig.useStaging || false;

    let sslInfo = {
      valid: false,
      issuer: 'Unknown',
      validFrom: new Date(),
      validTo: new Date(),
      daysUntilExpiry: 0
    };

    try {
      const sslCheck = await checkSSLCertificate(domain);
      if (sslCheck.valid !== false) {
        sslInfo = {
          valid: sslCheck.valid,
          issuer: sslCheck.issuer || 'Unknown',
          validFrom: sslCheck.validFrom,
          validTo: sslCheck.validTo,
          daysUntilExpiry: sslCheck.daysUntilExpiry
        };
      }
    } catch (error) {
      logger.error('SSL check failed', { domain, error: error.message });
    }

    let status = 'none';
    if (sslInfo.valid) {
      if (sslInfo.daysUntilExpiry <= 30) {
        status = 'expiring';
      } else {
        status = 'valid';
      }
    } else if (sslInfo.daysUntilExpiry < 0) {
      status = 'expired';
    }

    res.json({
      success: true,
      certificate: {
        domain,
        status,
        expiresAt: sslInfo.validTo,
        issuer: sslInfo.issuer,
        useStaging,
        autoRenew: sslConfig.enabled || false
      }
    });
  } catch (error) {
    logger.error('Failed to fetch SSL certificate', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SSL certificate',
      error: error.message
    });
  }
});

/**
 * POST /api/ssl/certificates/:deploymentId/renew
 * Manually trigger SSL certificate renewal
 */
router.post('/certificates/:deploymentId/renew', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

    // Verify ownership
    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    const domain = deployment.domains && deployment.domains[0];
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Deployment has no domain configured'
      });
    }

    const sslConfig = deployment.configuration?.ssl || {};
    const useStaging = sslConfig.useStaging || false;

    logger.info('Manual SSL renewal requested', {
      deploymentId,
      domain,
      useStaging,
      userId: req.user.userId
    });

    // Execute certbot renewal command
    try {
      const stagingFlag = useStaging ? '--staging' : '';
      const command = `sudo certbot certonly --nginx -d ${domain} ${stagingFlag} --non-interactive --agree-tos --email support@focuswithfocal.com --force-renewal`;

      const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 minute timeout

      logger.info('SSL renewal completed', {
        deploymentId,
        domain,
        useStaging,
        stdout,
        stderr
      });

      // Reload nginx to apply new certificate
      await execAsync('sudo systemctl reload nginx');

      res.json({
        success: true,
        message: 'SSL certificate renewed successfully',
        domain,
        useStaging
      });
    } catch (execError) {
      logger.error('SSL renewal command failed', {
        deploymentId,
        domain,
        useStaging,
        error: execError.message,
        stderr: execError.stderr
      });

      res.status(500).json({
        success: false,
        message: 'SSL renewal failed',
        error: execError.stderr || execError.message
      });
    }
  } catch (error) {
    logger.error('SSL renewal error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to renew SSL certificate',
      error: error.message
    });
  }
});

/**
 * PUT /api/ssl/certificates/:deploymentId/auto-renew
 * Toggle auto-renewal for SSL certificate
 */
router.put('/certificates/:deploymentId/auto-renew', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);
    const { autoRenew } = req.body;

    // Verify ownership
    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    // Update SSL configuration in the configuration JSONB field
    const currentConfig = deployment.configuration || {};
    const sslConfig = currentConfig.ssl || {};

    sslConfig.enabled = autoRenew;
    currentConfig.ssl = sslConfig;

    await deployment.update({
      configuration: currentConfig
    });

    logger.info('SSL auto-renew toggled', {
      deploymentId,
      autoRenew,
      userId: req.user.userId
    });

    res.json({
      success: true,
      message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
      autoRenew
    });
  } catch (error) {
    logger.error('Failed to toggle auto-renew', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle auto-renew',
      error: error.message
    });
  }
});

/**
 * PUT /api/ssl/certificates/:deploymentId/toggle-staging
 * Toggle between staging and production SSL certificate
 */
router.put('/certificates/:deploymentId/toggle-staging', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);
    const { useStaging } = req.body;

    // Verify ownership
    const deployment = await Deployment.findOne({
      where: {
        id: deploymentId,
        user_id: req.user.userId
      }
    });

    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'Deployment not found'
      });
    }

    const domain = deployment.domains && deployment.domains[0];
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Deployment has no domain configured'
      });
    }

    // Update SSL configuration
    const currentConfig = deployment.configuration || {};
    const sslConfig = currentConfig.ssl || {};

    sslConfig.useStaging = useStaging;
    currentConfig.ssl = sslConfig;

    await deployment.update({
      configuration: currentConfig
    });

    logger.info('SSL staging mode toggled', {
      deploymentId,
      domain,
      useStaging,
      userId: req.user.userId
    });

    // If switching to production, we should regenerate the certificate
    if (!useStaging) {
      try {
        logger.info('Regenerating SSL certificate in production mode', { deploymentId, domain });

        const command = `sudo certbot certonly --nginx -d ${domain} --non-interactive --agree-tos --email support@focuswithfocal.com --force-renewal`;
        const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

        logger.info('Production SSL certificate generated', {
          deploymentId,
          domain,
          stdout,
          stderr
        });

        // Reload nginx
        await execAsync('sudo systemctl reload nginx');

        res.json({
          success: true,
          message: `SSL mode changed to ${useStaging ? 'staging' : 'production'} and certificate regenerated`,
          useStaging,
          certificateRegenerated: true
        });
      } catch (execError) {
        logger.error('Failed to regenerate certificate', {
          deploymentId,
          domain,
          error: execError.message,
          stderr: execError.stderr
        });

        // Still update the setting even if cert regeneration failed
        res.json({
          success: true,
          message: `SSL mode changed to ${useStaging ? 'staging' : 'production'} but certificate regeneration failed`,
          useStaging,
          certificateRegenerated: false,
          error: execError.stderr || execError.message
        });
      }
    } else {
      res.json({
        success: true,
        message: `SSL mode changed to ${useStaging ? 'staging' : 'production'}`,
        useStaging,
        note: 'Certificate will be regenerated on next renewal'
      });
    }
  } catch (error) {
    logger.error('Failed to toggle SSL staging mode', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to toggle SSL staging mode',
      error: error.message
    });
  }
});

module.exports = router;
