/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * DNS Management Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getModels } = require('../models');
const logger = require('../utils/logger');
const { Route53Client, ListResourceRecordSetsCommand, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { checkSSLCertificate } = require('../services/sslChecker');
const dns = require('dns').promises;

/**
 * Get Route53 client with deployment credentials
 */
async function getRoute53Client(deployment) {
  const { AWSCredential } = getModels();

  const credential = await AWSCredential.findOne({
    where: { user_id: deployment.user_id }
  });

  if (!credential) {
    throw new Error('AWS credentials not found');
  }

  return new Route53Client({
    region: 'us-east-1', // Route53 is global, but client needs a region
    credentials: {
      accessKeyId: credential.access_key_id,
      secretAccessKey: credential.secret_access_key
    }
  });
}

/**
 * GET /api/dns/:deploymentId/status
 * Get DNS status for all configured domains
 */
router.get('/:deploymentId/status', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

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

    const domains = deployment.configuration?.domains || [];
    const primaryDomain = deployment.configuration?.primaryDomain;

    if (domains.length === 0 && !primaryDomain) {
      return res.json({
        success: true,
        domains: [],
        message: 'No domains configured'
      });
    }

    // Get DNS status for each domain
    const allDomains = [...new Set([primaryDomain, ...domains].filter(Boolean))];

    const domainStatuses = await Promise.all(
      allDomains.map(async (domain) => {
        try {
          // Check DNS resolution
          const addresses = await dns.resolve4(domain).catch(() => []);
          const resolved = addresses.length > 0;
          const pointsToDeployment = addresses.includes(deployment.public_ip);

          // Check SSL if domain resolves
          let ssl = { valid: false, daysUntilExpiry: 0 };
          if (resolved) {
            try {
              const sslCheck = await checkSSLCertificate(domain);
              ssl = {
                valid: sslCheck.valid,
                daysUntilExpiry: sslCheck.daysUntilExpiry || 0,
                expiresAt: sslCheck.expiresAt
              };
            } catch (error) {
              logger.warn('SSL check failed', { domain, error: error.message });
            }
          }

          return {
            domain,
            resolved,
            addresses,
            pointsToDeployment,
            expectedIp: deployment.public_ip,
            ssl,
            status: pointsToDeployment ? 'configured' : resolved ? 'misconfigured' : 'not_resolved'
          };
        } catch (error) {
          return {
            domain,
            resolved: false,
            addresses: [],
            pointsToDeployment: false,
            expectedIp: deployment.public_ip,
            ssl: { valid: false, daysUntilExpiry: 0 },
            status: 'error',
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      domains: domainStatuses,
      deploymentIp: deployment.public_ip
    });
  } catch (error) {
    logger.error('Failed to get DNS status', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get DNS status',
      error: error.message
    });
  }
});

/**
 * POST /api/dns/:deploymentId/sync
 * Sync DNS records for all configured domains
 */
router.post('/:deploymentId/sync', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

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

    if (!deployment.public_ip) {
      return res.status(400).json({
        success: false,
        message: 'Deployment does not have a public IP'
      });
    }

    const domains = deployment.configuration?.domains || [];
    const primaryDomain = deployment.configuration?.primaryDomain;
    const hostedZoneId = deployment.configuration?.hostedZoneId;

    if (!hostedZoneId) {
      return res.status(400).json({
        success: false,
        message: 'No hosted zone configured for this deployment'
      });
    }

    const allDomains = [...new Set([primaryDomain, ...domains].filter(Boolean))];

    if (allDomains.length === 0) {
      return res.json({
        success: true,
        message: 'No domains to sync'
      });
    }

    // Get Route53 client
    const route53 = await getRoute53Client(deployment);

    // Update DNS records for each domain
    const results = [];
    for (const domain of allDomains) {
      try {
        const params = {
          HostedZoneId: hostedZoneId,
          ChangeBatch: {
            Changes: [
              {
                Action: 'UPSERT',
                ResourceRecordSet: {
                  Name: domain,
                  Type: 'A',
                  TTL: 300,
                  ResourceRecords: [{ Value: deployment.public_ip }]
                }
              }
            ]
          }
        };

        const command = new ChangeResourceRecordSetsCommand(params);
        const response = await route53.send(command);

        results.push({
          domain,
          success: true,
          changeId: response.ChangeInfo.Id,
          status: response.ChangeInfo.Status
        });

        logger.info('DNS record synced', {
          deploymentId,
          domain,
          ip: deployment.public_ip
        });
      } catch (error) {
        results.push({
          domain,
          success: false,
          error: error.message
        });

        logger.error('Failed to sync DNS record', {
          deploymentId,
          domain,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      message: `Synced ${results.filter(r => r.success).length} of ${results.length} domains`
    });
  } catch (error) {
    logger.error('Failed to sync DNS', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to sync DNS records',
      error: error.message
    });
  }
});

/**
 * POST /api/dns/:deploymentId/verify
 * Verify DNS propagation for all domains
 */
router.post('/:deploymentId/verify', authenticate, async (req, res) => {
  try {
    const { Deployment } = getModels();
    const deploymentId = parseInt(req.params.deploymentId);

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

    const domains = deployment.configuration?.domains || [];
    const primaryDomain = deployment.configuration?.primaryDomain;
    const allDomains = [...new Set([primaryDomain, ...domains].filter(Boolean))];

    if (allDomains.length === 0) {
      return res.json({
        success: true,
        message: 'No domains to verify',
        results: []
      });
    }

    // Verify each domain
    const results = await Promise.all(
      allDomains.map(async (domain) => {
        try {
          const addresses = await dns.resolve4(domain);
          const propagated = addresses.includes(deployment.public_ip);

          return {
            domain,
            propagated,
            currentIp: addresses[0] || null,
            expectedIp: deployment.public_ip,
            allAddresses: addresses
          };
        } catch (error) {
          return {
            domain,
            propagated: false,
            currentIp: null,
            expectedIp: deployment.public_ip,
            error: error.message
          };
        }
      })
    );

    const allPropagated = results.every(r => r.propagated);

    res.json({
      success: true,
      allPropagated,
      results,
      message: allPropagated
        ? 'All domains have propagated correctly'
        : 'Some domains have not propagated yet'
    });
  } catch (error) {
    logger.error('Failed to verify DNS', {
      deploymentId: req.params.deploymentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to verify DNS propagation',
      error: error.message
    });
  }
});

module.exports = router;
