#!/usr/bin/env node

/**
 * Test script to verify Quick Setup validation fix
 */

const ConfigurationValidator = require('./lib/wizard/configuration-validator');
const InfrastructureConfigurator = require('./lib/wizard/infrastructure-configurator');
const SecurityConfigurator = require('./lib/wizard/security-configurator');

async function testQuickSetupValidation() {
  console.log('🧪 Testing Quick Setup validation fix...\n');

  try {
    // Create configurators
    const infraConfigurator = new InfrastructureConfigurator();
    const securityConfigurator = new SecurityConfigurator();
    const validator = new ConfigurationValidator();

    // Generate Quick Setup configurations
    console.log('📋 Generating Quick Setup configurations...');
    const infrastructure = await infraConfigurator.configure(null, 'quick');
    const security = await securityConfigurator.configure('quick');

    console.log('\n📊 Infrastructure config structure:');
    console.log(JSON.stringify(infrastructure, null, 2));

    console.log('\n🔒 Security config structure:');
    console.log(JSON.stringify(security, null, 2));

    // Test validation
    console.log('\n✅ Testing validation...');
    const stepData = {
      infrastructure,
      security
    };

    const validation = await validator.validateAll(stepData);

    console.log('\n📋 Validation results:');
    console.log(`Valid: ${validation.valid}`);
    console.log(`Errors: ${validation.errors.length}`);
    console.log(`Warnings: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Validation errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(`\n📝 Summary: ${validation.summary}`);

    if (validation.valid) {
      console.log('\n✅ SUCCESS: Quick Setup validation passes!');
      return true;
    } else {
      console.log('\n❌ FAILURE: Quick Setup validation still fails');
      return false;
    }

  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
testQuickSetupValidation().then(success => {
  process.exit(success ? 0 : 1);
});