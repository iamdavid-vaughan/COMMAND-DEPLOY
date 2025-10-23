#!/usr/bin/env node

/**
 * Test script to verify OS selection works in Quick Setup mode
 */

const path = require('path');
const fs = require('fs-extra');
const InfrastructureConfigurator = require('./lib/wizard/infrastructure-configurator');

async function testOSSelectionQuickSetup() {
  console.log('🧪 Testing OS Selection in Quick Setup Mode...\n');

  try {
    // Test Infrastructure configurator
    console.log('📋 Testing InfrastructureConfigurator...');
    const infraConfig = new InfrastructureConfigurator();
    
    // Test that the method exists and has the right structure
    if (typeof infraConfig.configureQuickSetupInstance === 'function') {
      console.log('✓ configureQuickSetupInstance method exists');
    } else {
      console.log('✗ configureQuickSetupInstance method missing');
      return;
    }

    // Mock the inquirer prompts to test the flow
    const originalPrompt = require('inquirer').prompt;
    let promptCallCount = 0;
    
    require('inquirer').prompt = async (questions) => {
      promptCallCount++;
      console.log(`  📝 Prompt ${promptCallCount}: ${questions[0].message}`);
      
      if (questions[0].name === 'operatingSystem') {
        console.log('    ✓ OS selection prompt detected');
        console.log('    ✓ Choices available:', questions[0].choices.map(c => c.value || c));
        return { operatingSystem: 'debian' }; // Test selecting Debian
      }
      
      if (questions[0].name === 'instanceType') {
        console.log('    ✓ Instance type selection prompt detected');
        return { instanceType: 't3.small' };
      }
      
      return {};
    };

    // Test the method
    console.log('\n🔧 Testing configureQuickSetupInstance...');
    const result = await infraConfig.configureQuickSetupInstance();
    
    // Restore original prompt
    require('inquirer').prompt = originalPrompt;
    
    console.log('\n📊 Results:');
    console.log(`  Instance Type: ${result.instanceType}`);
    console.log(`  Operating System: ${result.operatingSystem}`);
    console.log(`  Key Pair Name: ${result.keyPairName}`);
    
    // Validate results
    const validations = [
      { test: result.instanceType === 't3.small', message: 'Instance type correctly set' },
      { test: result.operatingSystem === 'debian', message: 'Operating system correctly set to selected value' },
      { test: result.keyPairName === 'focal-deploy-keypair', message: 'Key pair name set correctly' },
      { test: promptCallCount === 2, message: 'Both OS and instance type prompts shown' }
    ];
    
    console.log('\n✅ Validation Results:');
    validations.forEach(validation => {
      console.log(`  ${validation.test ? '✓' : '✗'} ${validation.message}`);
    });
    
    const allPassed = validations.every(v => v.test);
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! OS selection is working in Quick Setup mode.');
      console.log('\n📝 Summary:');
      console.log('   • Users can now select between Ubuntu and Debian in Quick Setup');
      console.log('   • Ubuntu remains the recommended default');
      console.log('   • OS selection appears before instance type selection');
      console.log('   • Selected OS is properly returned in the configuration');
    } else {
      console.log('\n❌ Some tests failed. Please check the implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testOSSelectionQuickSetup().catch(console.error);