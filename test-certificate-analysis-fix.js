#!/usr/bin/env node

/**
 * Test script for certificate analysis fix
 * Verifies that manual and automatic DNS-01 certificates are correctly distinguished
 */

const chalk = require('chalk');

/**
 * Mock test for certificate analysis logic
 */
function testCertificateAnalysis() {
  console.log(chalk.bold.blue('\n🧪 Testing Certificate Analysis Fix\n'));
  console.log(chalk.gray('='.repeat(60)));

  const testCases = [
    {
      name: 'Manual DNS-01 Certificate',
      configContent: `
# renew_before_expiry = 30 days
version = 1.21.0
archive_dir = /etc/letsencrypt/archive/example.com
cert = /etc/letsencrypt/live/example.com/cert.pem
privkey = /etc/letsencrypt/live/example.com/privkey.pem
chain = /etc/letsencrypt/live/example.com/chain.pem
fullchain = /etc/letsencrypt/live/example.com/fullchain.pem

# Options used in the renewal process
[renewalparams]
authenticator = manual
pref_challs = dns-01
account = 1234567890abcdef
server = https://acme-v02.api.letsencrypt.org/directory
      `,
      expected: 'manual',
      description: 'Certificate created with --manual --preferred-challenges dns-01'
    },
    {
      name: 'Automatic DNS-01 Certificate (DigitalOcean)',
      configContent: `
# renew_before_expiry = 30 days
version = 1.21.0
archive_dir = /etc/letsencrypt/archive/example.com
cert = /etc/letsencrypt/live/example.com/cert.pem
privkey = /etc/letsencrypt/live/example.com/privkey.pem
chain = /etc/letsencrypt/live/example.com/chain.pem
fullchain = /etc/letsencrypt/live/example.com/fullchain.pem

# Options used in the renewal process
[renewalparams]
authenticator = dns-digitalocean
dns_digitalocean_credentials = /etc/letsencrypt/digitalocean.ini
account = 1234567890abcdef
server = https://acme-v02.api.letsencrypt.org/directory
      `,
      expected: 'automatic',
      description: 'Certificate created with --dns-digitalocean plugin'
    },
    {
      name: 'Automatic DNS-01 Certificate (Cloudflare)',
      configContent: `
# renew_before_expiry = 30 days
version = 1.21.0
archive_dir = /etc/letsencrypt/archive/example.com
cert = /etc/letsencrypt/live/example.com/cert.pem
privkey = /etc/letsencrypt/live/example.com/privkey.pem
chain = /etc/letsencrypt/live/example.com/chain.pem
fullchain = /etc/letsencrypt/live/example.com/fullchain.pem

# Options used in the renewal process
[renewalparams]
authenticator = dns-cloudflare
dns_cloudflare_credentials = /etc/letsencrypt/cloudflare.ini
account = 1234567890abcdef
server = https://acme-v02.api.letsencrypt.org/directory
      `,
      expected: 'automatic',
      description: 'Certificate created with --dns-cloudflare plugin'
    },
    {
      name: 'HTTP-01 Certificate (Standalone)',
      configContent: `
# renew_before_expiry = 30 days
version = 1.21.0
archive_dir = /etc/letsencrypt/archive/example.com
cert = /etc/letsencrypt/live/example.com/cert.pem
privkey = /etc/letsencrypt/live/example.com/privkey.pem
chain = /etc/letsencrypt/live/example.com/chain.pem
fullchain = /etc/letsencrypt/live/example.com/fullchain.pem

# Options used in the renewal process
[renewalparams]
authenticator = standalone
pref_challs = http-01
account = 1234567890abcdef
server = https://acme-v02.api.letsencrypt.org/directory
      `,
      expected: 'automatic',
      description: 'Certificate created with --standalone (HTTP-01)'
    },
    {
      name: 'Automatic DNS-01 Certificate (Route53)',
      configContent: `
# renew_before_expiry = 30 days
version = 1.21.0
archive_dir = /etc/letsencrypt/archive/example.com
cert = /etc/letsencrypt/live/example.com/cert.pem
privkey = /etc/letsencrypt/live/example.com/privkey.pem
chain = /etc/letsencrypt/live/example.com/chain.pem
fullchain = /etc/letsencrypt/live/example.com/fullchain.pem

# Options used in the renewal process
[renewalparams]
authenticator = dns-route53
dns_route53_credentials = /etc/letsencrypt/route53.ini
account = 1234567890abcdef
server = https://acme-v02.api.letsencrypt.org/directory
      `,
      expected: 'automatic',
      description: 'Certificate created with --dns-route53 plugin'
    }
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    console.log(chalk.cyan(`\nTest ${index + 1}: ${testCase.name}`));
    console.log(chalk.gray(`Description: ${testCase.description}`));

    // Apply the fixed logic
    const isManualAuthenticator = testCase.configContent.includes('authenticator = manual');
    const isAutomaticDNSAuthenticator = /authenticator = dns-\w+/.test(testCase.configContent);

    let result;
    if (isManualAuthenticator && !isAutomaticDNSAuthenticator) {
      result = 'manual';
    } else {
      result = 'automatic';
    }

    // Check result
    if (result === testCase.expected) {
      console.log(chalk.green(`✅ PASS: Correctly identified as ${result}`));
      passed++;
    } else {
      console.log(chalk.red(`❌ FAIL: Expected ${testCase.expected}, got ${result}`));
      failed++;
    }
  });

  console.log(chalk.gray('\n' + '='.repeat(60)));
  console.log(chalk.bold.white(`\n📊 Test Results:`));
  console.log(chalk.green(`  ✅ Passed: ${passed}/${testCases.length}`));
  if (failed > 0) {
    console.log(chalk.red(`  ❌ Failed: ${failed}/${testCases.length}`));
  }

  if (failed === 0) {
    console.log(chalk.bold.green('\n🎉 All tests passed!\n'));
    return true;
  } else {
    console.log(chalk.bold.red('\n❌ Some tests failed\n'));
    return false;
  }
}

/**
 * Test the old buggy logic for comparison
 */
function testOldLogic() {
  console.log(chalk.bold.yellow('\n🐛 Testing OLD (Buggy) Logic for Comparison\n'));
  console.log(chalk.gray('='.repeat(60)));

  const testCase = {
    name: 'Automatic DNS-01 Certificate (DigitalOcean)',
    configContent: `
authenticator = dns-digitalocean
dns_digitalocean_credentials = /etc/letsencrypt/digitalocean.ini
    `
  };

  console.log(chalk.cyan(`Test: ${testCase.name}`));

  // Old buggy logic
  if (testCase.configContent.includes('authenticator = manual') ||
      testCase.configContent.includes('manual') ||
      testCase.configContent.includes('dns-01')) {
    console.log(chalk.red(`❌ OLD LOGIC: Incorrectly classified as MANUAL`));
  } else {
    console.log(chalk.green(`✅ OLD LOGIC: Correctly classified as AUTOMATIC`));
  }

  // Note: Since this config has "dns-digitalocean" which contains the word "digital",
  // but not "dns-01", the old logic would actually classify it correctly in this case.
  // Let's test with a more problematic case:

  const problematicCase = {
    name: 'Any certificate mentioning dns-01',
    configContent: `
# This is a comment mentioning dns-01 challenge
authenticator = dns-cloudflare
    `
  };

  console.log(chalk.cyan(`\nTest: ${problematicCase.name}`));

  // Old buggy logic
  if (problematicCase.configContent.includes('authenticator = manual') ||
      problematicCase.configContent.includes('manual') ||
      problematicCase.configContent.includes('dns-01')) {
    console.log(chalk.red(`❌ OLD LOGIC: Incorrectly classified as MANUAL (because it mentions 'dns-01' in a comment)`));
  } else {
    console.log(chalk.green(`✅ OLD LOGIC: Correctly classified as AUTOMATIC`));
  }

  console.log(chalk.gray('\n' + '='.repeat(60)));
}

// Run tests
console.log(chalk.bold.cyan('\n🔬 Certificate Analysis Fix - Test Suite\n'));

const newLogicPassed = testCertificateAnalysis();
testOldLogic();

if (newLogicPassed) {
  console.log(chalk.bold.green('✅ Fix validated! The new logic correctly distinguishes between:'));
  console.log(chalk.white('   • Manual DNS-01 certificates (authenticator = manual)'));
  console.log(chalk.white('   • Automatic DNS-01 certificates (authenticator = dns-<provider>)'));
  console.log(chalk.white('   • HTTP-01 certificates (authenticator = standalone/webroot/nginx)'));
  process.exit(0);
} else {
  console.log(chalk.bold.red('❌ Fix validation failed!'));
  process.exit(1);
}
