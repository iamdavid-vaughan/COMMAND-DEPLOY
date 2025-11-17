#!/usr/bin/env node

/**
 * focal-deploy-dns-fix - Standalone DNS update utility for wizard deployments
 *
 * Usage: Run this from inside your deployment directory (e.g., focal-saas-api/)
 *   node focal-deploy-dns-fix.js
 *
 * This script will:
 * 1. Load configuration from .focal-deploy/config.json
 * 2. Connect to DigitalOcean API
 * 3. Create/update DNS A records for all configured domains
 * 4. Display detailed results for each domain
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(process.cwd(), '.focal-deploy', 'config.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadConfig() {
  log('\n🔍 Loading configuration...', 'cyan');

  if (!fs.existsSync(CONFIG_PATH)) {
    log(`❌ Configuration file not found: ${CONFIG_PATH}`, 'red');
    log('   Make sure you run this from your deployment directory', 'yellow');
    process.exit(1);
  }

  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configData);
    log('✅ Configuration loaded successfully', 'green');
    return config;
  } catch (error) {
    log(`❌ Failed to load configuration: ${error.message}`, 'red');
    process.exit(1);
  }
}

function makeDigitalOceanRequest(token, method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.digitalocean.com',
      port: 443,
      path: `/v2${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function parseDomain(fullDomain) {
  // Parse api.focuswithfocal.io => { baseDomain: 'focuswithfocal.io', recordName: 'api' }
  const parts = fullDomain.split('.');

  if (parts.length === 2) {
    // Root domain like focuswithfocal.io
    return { baseDomain: fullDomain, recordName: '@' };
  } else if (parts.length >= 3) {
    // Subdomain like api.focuswithfocal.io
    const baseDomain = parts.slice(-2).join('.');
    const recordName = parts.slice(0, -2).join('.');
    return { baseDomain, recordName };
  }

  throw new Error(`Invalid domain format: ${fullDomain}`);
}

async function updateDomainRecord(token, domain, targetIP) {
  try {
    const { baseDomain, recordName } = await parseDomain(domain);

    log(`\n📝 Processing: ${domain}`, 'blue');
    log(`   Base domain: ${baseDomain}`, 'cyan');
    log(`   Record name: ${recordName}`, 'cyan');
    log(`   Target IP: ${targetIP}`, 'cyan');

    // Get existing records for this domain
    log('   Checking existing records...', 'yellow');
    const records = await makeDigitalOceanRequest(
      token,
      'GET',
      `/domains/${baseDomain}/records`
    );

    // Find existing A record
    const existingRecord = records.domain_records.find(r =>
      r.type === 'A' && r.name === recordName
    );

    if (existingRecord) {
      if (existingRecord.data === targetIP) {
        log('   ✅ Record already points to correct IP (no change needed)', 'green');
        return { domain, status: 'no_change', targetIP };
      }

      // Update existing record
      log(`   🔄 Updating existing record (${existingRecord.data} → ${targetIP})...`, 'yellow');
      await makeDigitalOceanRequest(
        token,
        'PUT',
        `/domains/${baseDomain}/records/${existingRecord.id}`,
        {
          type: 'A',
          name: recordName,
          data: targetIP,
          ttl: 300
        }
      );
      log(`   ✅ Successfully updated ${domain} → ${targetIP}`, 'green');
      return { domain, status: 'updated', targetIP, previousIP: existingRecord.data };
    } else {
      // Create new record
      log('   ➕ Creating new A record...', 'yellow');
      await makeDigitalOceanRequest(
        token,
        'POST',
        `/domains/${baseDomain}/records`,
        {
          type: 'A',
          name: recordName,
          data: targetIP,
          ttl: 300
        }
      );
      log(`   ✅ Successfully created ${domain} → ${targetIP}`, 'green');
      return { domain, status: 'created', targetIP };
    }
  } catch (error) {
    log(`   ❌ Failed: ${error.message}`, 'red');
    return { domain, status: 'error', error: error.message };
  }
}

async function main() {
  log('\n╔═══════════════════════════════════════════════════╗', 'cyan');
  log('║    Focal Deploy - DNS Fix Utility                ║', 'cyan');
  log('╚═══════════════════════════════════════════════════╝', 'cyan');

  // Load configuration
  const config = loadConfig();

  // Extract DNS configuration
  const dnsConfig = config.dnsConfig;
  if (!dnsConfig || !dnsConfig.enabled) {
    log('❌ DNS automation is not enabled in configuration', 'red');
    process.exit(1);
  }

  const provider = dnsConfig.provider;
  if (provider.name !== 'digitalocean') {
    log(`❌ This utility only supports DigitalOcean (found: ${provider.name})`, 'red');
    process.exit(1);
  }

  const token = provider.credentials.token;
  if (!token) {
    log('❌ DigitalOcean API token not found in configuration', 'red');
    process.exit(1);
  }

  // Extract target IP
  const targetIP = config.infrastructure?.ec2Instance?.publicIpAddress;
  if (!targetIP) {
    log('❌ EC2 instance public IP not found in configuration', 'red');
    process.exit(1);
  }

  const domains = dnsConfig.domains || [];
  if (domains.length === 0) {
    log('❌ No domains configured', 'red');
    process.exit(1);
  }

  log(`\n📊 Configuration Summary:`, 'blue');
  log(`   Provider: DigitalOcean`, 'cyan');
  log(`   Target IP: ${targetIP}`, 'cyan');
  log(`   Domains to update: ${domains.length}`, 'cyan');
  domains.forEach(d => log(`      • ${d}`, 'cyan'));

  // Confirm before proceeding
  log(`\n⚠️  This will update DNS records in DigitalOcean`, 'yellow');
  log(`   Press Ctrl+C to cancel, or wait 5 seconds to proceed...`, 'yellow');

  await new Promise(resolve => setTimeout(resolve, 5000));

  log(`\n🚀 Starting DNS update...`, 'green');

  // Update each domain
  const results = [];
  for (const domain of domains) {
    const result = await updateDomainRecord(token, domain, targetIP);
    results.push(result);
  }

  // Summary
  log(`\n╔═══════════════════════════════════════════════════╗`, 'cyan');
  log(`║    Summary                                        ║`, 'cyan');
  log(`╚═══════════════════════════════════════════════════╝`, 'cyan');

  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const noChange = results.filter(r => r.status === 'no_change').length;
  const errors = results.filter(r => r.status === 'error').length;

  log(`\n📊 Results:`, 'blue');
  if (created > 0) log(`   ➕ Created: ${created}`, 'green');
  if (updated > 0) log(`   🔄 Updated: ${updated}`, 'green');
  if (noChange > 0) log(`   ✅ No change: ${noChange}`, 'green');
  if (errors > 0) log(`   ❌ Errors: ${errors}`, 'red');

  if (errors > 0) {
    log(`\n❌ Failed domains:`, 'red');
    results.filter(r => r.status === 'error').forEach(r => {
      log(`   • ${r.domain}: ${r.error}`, 'red');
    });
    process.exit(1);
  } else {
    log(`\n✅ All DNS records updated successfully!`, 'green');
    log(`\n⏳ DNS propagation may take 5-30 minutes`, 'yellow');
    log(`   You can verify with: curl https://api.focuswithfocal.io/api/health`, 'blue');
  }
}

main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
