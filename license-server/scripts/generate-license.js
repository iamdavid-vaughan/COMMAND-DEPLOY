#!/usr/bin/env node

const crypto = require('crypto');
const Database = require('better-sqlite3');
const readline = require('readline');

const db = new Database('licenses.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Generate license key
function generateLicenseKey(type, version) {
  const hash = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FCLDPLY-${type}-${version}-${hash}`;
}

// Add years to date
function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result.toISOString();
}

async function main() {
  console.log('\n🔑 Focal Deploy License Generator\n');
  console.log('License Types:');
  console.log('  1. SUPER    - Unlimited (for you only)');
  console.log('  2. ALPHA    - Lifetime access to all versions');
  console.log('  3. BETA     - Current major version only, 1 year');
  console.log('  4. PRO      - Specific version, annual renewal');
  console.log('');

  const typeChoice = await question('Select license type (1-4): ');

  let licenseType, versionLimit, maxActivations, expiresAt, email;

  switch (typeChoice) {
    case '1': // SUPER
      licenseType = 'SUPER';
      versionLimit = 'LIFETIME';
      maxActivations = 999;
      expiresAt = null;
      email = null; // No email required
      console.log('\n⭐ Generating SUPER license (unlimited, lifetime, any email)');
      break;

    case '2': // ALPHA
      licenseType = 'ALPHA';
      versionLimit = 'LIFETIME';
      maxActivations = 3;
      expiresAt = null; // Lifetime
      email = await question('Enter user email: ');
      console.log(`\n🚀 Generating ALPHA license for ${email} (lifetime, 3 machines)`);
      break;

    case '3': // BETA
      licenseType = 'BETA';
      const currentVersion = await question('Enter current major version (e.g., 2.x): ');
      versionLimit = currentVersion;
      maxActivations = 2;
      expiresAt = addYears(new Date(), 1); // 1 year
      email = await question('Enter user email: ');
      console.log(`\n🧪 Generating BETA license for ${email} (v${versionLimit}, 1 year, 2 machines)`);
      break;

    case '4': // PRO
      licenseType = 'PRO';
      const proVersion = await question('Enter version limit (e.g., 2.x): ');
      versionLimit = proVersion;
      maxActivations = 1;
      expiresAt = addYears(new Date(), 1); // 1 year
      email = await question('Enter user email: ');
      console.log(`\n💼 Generating PRO license for ${email} (v${versionLimit}, 1 year, 1 machine)`);
      break;

    default:
      console.log('Invalid choice');
      rl.close();
      return;
  }

  // Generate key
  const licenseKey = generateLicenseKey(licenseType, versionLimit.replace('.', ''));

  // Insert into database
  try {
    db.prepare(`
      INSERT INTO licenses (
        license_key, email, license_type, version_limit,
        max_activations, current_activations, expires_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(licenseKey, email, licenseType, versionLimit, maxActivations, expiresAt);

    console.log('\n✅ License created successfully!\n');
    console.log('━'.repeat(60));
    console.log(`License Key:    ${licenseKey}`);
    console.log(`Type:           ${licenseType}`);
    console.log(`Email:          ${email || 'ANY (Super license)'}`);
    console.log(`Version Limit:  ${versionLimit}`);
    console.log(`Max Machines:   ${maxActivations}`);
    console.log(`Expires:        ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'NEVER'}`);
    console.log('━'.repeat(60));
    console.log('');

    // Save to file
    const fs = require('fs');
    const licensesDir = './generated-licenses';
    if (!fs.existsSync(licensesDir)) {
      fs.mkdirSync(licensesDir);
    }

    const filename = `${licensesDir}/${licenseType}-${Date.now()}.txt`;
    fs.writeFileSync(filename, `
Focal Deploy License
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

License Key:    ${licenseKey}
Type:           ${licenseType}
Email:          ${email || 'ANY (Super license)'}
Version Limit:  ${versionLimit}
Max Machines:   ${maxActivations}
Expires:        ${expiresAt ? new Date(expiresAt).toLocaleDateString() : 'NEVER'}

Generated:      ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installation Instructions:
1. Run: focal-deploy activate
2. Enter this license key when prompted
3. Enter the email address above

Support: support@focal-deploy.com
    `.trim());

    console.log(`📄 License saved to: ${filename}\n`);

  } catch (error) {
    console.error('❌ Error creating license:', error.message);
  }

  rl.close();
}

main().catch(console.error);
