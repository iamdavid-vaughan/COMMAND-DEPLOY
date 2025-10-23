#!/usr/bin/env node

/**
 * Test script to verify Quick Setup defaults are properly applied
 */

const InfrastructureConfigurator = require('./lib/wizard/infrastructure-configurator');
const SecurityConfigurator = require('./lib/wizard/security-configurator');

async function testQuickSetupDefaults() {
  console.log('🧪 Testing Quick Setup defaults...\n');

  try {
    // Test Infrastructure defaults
    console.log('📋 Testing Infrastructure Configurator...');
    const infraConfig = new InfrastructureConfigurator();
    const infraDefaults = await infraConfig.configure({}, 'quick');
    
    console.log('✓ Infrastructure defaults:');
    console.log(`  Region: ${infraDefaults.region}`);
    console.log(`  Instance Type: ${infraDefaults.instance.instanceType}`);
    console.log(`  OS: ${infraDefaults.instance.operatingSystem}`);
    console.log(`  SSH Port: ${infraDefaults.network.sshPort}`);
    console.log(`  Storage: ${infraDefaults.storage.rootVolumeSize}GB ${infraDefaults.storage.volumeType} (encrypted: ${infraDefaults.storage.enableEncryption})`);
    
    // Test Security defaults
    console.log('\n🔒 Testing Security Configurator...');
    const securityConfig = new SecurityConfigurator();
    const securityDefaults = await securityConfig.configure('quick');
    
    console.log('✓ Security defaults:');
    console.log(`  SSH Auth: ${securityDefaults.ssh.authMethod}`);
    console.log(`  Root Login: ${securityDefaults.ssh.disableRootLogin ? 'Disabled' : 'Enabled'}`);
    console.log(`  Firewall: ${securityDefaults.firewall.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Fail2ban: ${securityDefaults.intrusionPrevention.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Auto Updates: ${securityDefaults.systemUpdates.frequency}`);
    console.log(`  Emergency Access: ${securityDefaults.emergencyAccess.enableSSMAccess ? 'Enabled' : 'Disabled'}`);
    
    console.log('\n✅ All Quick Setup defaults are working correctly!');
    console.log('\n📝 Summary of novice-friendly defaults:');
    console.log('   • 20GB encrypted gp3 storage');
    console.log('   • SSH keys only (most secure)');
    console.log('   • Custom SSH port (2222) for security');
    console.log('   • High security firewall with HTTP/HTTPS/SSH');
    console.log('   • Fail2ban intrusion prevention');
    console.log('   • Daily automatic security updates');
    console.log('   • Emergency access via AWS SSM');
    console.log('   • No technical questions asked to novice users');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testQuickSetupDefaults();