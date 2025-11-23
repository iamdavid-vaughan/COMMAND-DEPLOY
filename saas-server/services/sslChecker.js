/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * SSL Certificate Checking Service
 */

const https = require('https');
const tls = require('tls');
const logger = require('../utils/logger');

/**
 * Check SSL certificate for a domain
 * @param {string} domain - Domain to check
 * @returns {Promise<Object>} Certificate info
 */
async function checkSSLCertificate(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port: 443,
      method: 'GET',
      rejectUnauthorized: false, // We want to check even invalid certs
      agent: false
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();

      if (!cert || Object.keys(cert).length === 0) {
        return resolve({
          valid: false,
          error: 'No certificate found',
          domain
        });
      }

      const now = new Date();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
      const isValid = now >= validFrom && now <= validTo;

      resolve({
        valid: isValid,
        domain,
        issuer: cert.issuer?.O || 'Unknown',
        subject: cert.subject?.CN || domain,
        validFrom,
        validTo,
        daysUntilExpiry,
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint,
        expiresAt: validTo
      });
    });

    req.on('error', (error) => {
      logger.error('SSL check error:', { domain, error: error.message });
      resolve({
        valid: false,
        error: error.message,
        domain
      });
    });

    req.setTimeout(5000, () => {
      req.abort();
      resolve({
        valid: false,
        error: 'Connection timeout',
        domain
      });
    });

    req.end();
  });
}

/**
 * Check SSL for multiple domains
 */
async function checkMultipleSSL(domains) {
  const results = await Promise.all(
    domains.map(domain => checkSSLCertificate(domain))
  );
  return results;
}

/**
 * Check if SSL certificate needs renewal
 */
function needsRenewal(cert, warningDays = 30) {
  return cert.valid && cert.daysUntilExpiry <= warningDays;
}

module.exports = {
  checkSSLCertificate,
  checkMultipleSSL,
  needsRenewal
};
