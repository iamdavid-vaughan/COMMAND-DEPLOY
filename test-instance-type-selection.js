#!/usr/bin/env node

/**
 * Test script to verify instance type selection works in Quick Setup
 */

const path = require('path');
const fs = require('fs-extra');
const InfrastructureConfigurator = require('./lib/wizard/infrastructure-configurator');

async function testInstanceTypeSelection() {
  console.log('🧪 Testing Instance Type Selection in Quick Setup...\n');
  
  try {
    // Initialize infrastructure configurator
    const configurator = new InfrastructureConfigurator();
    
    console.log('✓ Initialized InfrastructureConfigurator');
    
    // Mock AWS credentials for testing
    const mockCredentials = {
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      region: 'us-east-1'
    };
    
    console.log('✓ Created mock AWS credentials');
    
    // Test Quick Setup mode configuration
    console.log('\n📋 Testing Quick Setup infrastructure configuration...');
    console.log('Note: This test will show the instance type selection prompt');
    console.log('Please select an instance type to continue the test.\n');
    
    const infrastructureConfig = await configurator.configure(mockCredentials, 'quick');
    
    console.log('\n✅ Infrastructure configuration completed!');
    
    // Verify the configuration structure
    console.log('\n📊 Verifying configuration structure:');
    
    if (infrastructureConfig.region) {
      console.log(`  ✓ Region: ${infrastructureConfig.region}`);
    } else {
      console.log('  ❌ Missing region configuration');
    }
    
    if (infrastructureConfig.instance) {
      console.log(`  ✓ Instance type: ${infrastructureConfig.instance.instanceType}`);
      console.log(`  ✓ Operating system: ${infrastructureConfig.instance.operatingSystem}`);
      console.log(`  ✓ Key pair name: ${infrastructureConfig.instance.keyPairName}`);
    } else {
      console.log('  ❌ Missing instance configuration');
    }
    
    if (infrastructureConfig.network) {
      console.log(`  ✓ SSH port: ${infrastructureConfig.network.sshPort}`);
      console.log(`  ✓ Security level: ${infrastructureConfig.network.securityLevel}`);
    } else {
      console.log('  ❌ Missing network configuration');
    }
    
    if (infrastructureConfig.storage) {
      console.log(`  ✓ Root volume size: ${infrastructureConfig.storage.rootVolumeSize}GB`);
      console.log(`  ✓ Volume type: ${infrastructureConfig.storage.volumeType}`);
      console.log(`  ✓ Encryption: ${infrastructureConfig.storage.enableEncryption}`);
    } else {
      console.log('  ❌ Missing storage configuration');
    }
    
    if (infrastructureConfig.s3) {
      console.log(`  ✓ S3 enabled: ${infrastructureConfig.s3.enabled}`);
      console.log(`  ✓ S3 versioning: ${infrastructureConfig.s3.versioning}`);
      console.log(`  ✓ S3 encryption: ${infrastructureConfig.s3.encryption}`);
    } else {
      console.log('  ❌ Missing S3 configuration');
    }
    
    // Verify instance type selection worked
    const validInstanceTypes = ['t3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge'];
    if (validInstanceTypes.includes(infrastructureConfig.instance.instanceType)) {
      console.log(`\n✅ Instance type selection successful: ${infrastructureConfig.instance.instanceType}`);
    } else {
      console.log(`\n❌ Invalid instance type selected: ${infrastructureConfig.instance.instanceType}`);
    }
    
    // Show estimated cost based on selection
    const costMap = {
      't3.micro': '$7.59/month',
      't3.small': '$15.18/month',
      't3.medium': '$30.37/month',
      't3.large': '$60.74/month',
      't3.xlarge': '$121.47/month'
    };
    
    const selectedCost = costMap[infrastructureConfig.instance.instanceType];
    if (selectedCost) {
      console.log(`💰 Estimated monthly cost: ${selectedCost} (if running 24/7)`);
    }
    
    console.log('\n✅ SUCCESS: Instance type selection test completed!');
    console.log('📝 Quick Setup now allows users to choose their preferred EC2 instance type');
    
  } catch (error) {
    console.error('\n❌ Instance type selection test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the test
testInstanceTypeSelection().catch(console.error);