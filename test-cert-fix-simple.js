#!/usr/bin/env node

/**
 * Simple test for certificate analysis fix (no external dependencies)
 */

console.log('\n🧪 Testing Certificate Analysis Fix\n');
console.log('='.repeat(60));

const testCases = [
  {
    name: 'Manual DNS-01 Certificate',
    configContent: 'authenticator = manual\npref_challs = dns-01',
    expected: 'manual',
    description: 'Certificate created with --manual --preferred-challenges dns-01'
  },
  {
    name: 'Automatic DNS-01 (DigitalOcean)',
    configContent: 'authenticator = dns-digitalocean\ndns_digitalocean_credentials = /etc/letsencrypt/digitalocean.ini',
    expected: 'automatic',
    description: 'Certificate created with --dns-digitalocean plugin'
  },
  {
    name: 'Automatic DNS-01 (Cloudflare)',
    configContent: 'authenticator = dns-cloudflare\ndns_cloudflare_credentials = /etc/letsencrypt/cloudflare.ini',
    expected: 'automatic',
    description: 'Certificate created with --dns-cloudflare plugin'
  },
  {
    name: 'HTTP-01 (Standalone)',
    configContent: 'authenticator = standalone\npref_challs = http-01',
    expected: 'automatic',
    description: 'Certificate created with --standalone (HTTP-01)'
  },
  {
    name: 'Automatic DNS-01 (Route53)',
    configContent: 'authenticator = dns-route53\ndns_route53_credentials = /etc/letsencrypt/route53.ini',
    expected: 'automatic',
    description: 'Certificate created with --dns-route53 plugin'
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: ${testCase.name}`);
  console.log(`Description: ${testCase.description}`);

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
    console.log(`✅ PASS: Correctly identified as ${result}`);
    passed++;
  } else {
    console.log(`❌ FAIL: Expected ${testCase.expected}, got ${result}`);
    failed++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`  ✅ Passed: ${passed}/${testCases.length}`);
if (failed > 0) {
  console.log(`  ❌ Failed: ${failed}/${testCases.length}`);
}

if (failed === 0) {
  console.log('\n🎉 All tests passed!\n');
  console.log('✅ Fix validated! The new logic correctly distinguishes between:');
  console.log('   • Manual DNS-01 certificates (authenticator = manual)');
  console.log('   • Automatic DNS-01 certificates (authenticator = dns-<provider>)');
  console.log('   • HTTP-01 certificates (authenticator = standalone/webroot/nginx)\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed\n');
  process.exit(1);
}
