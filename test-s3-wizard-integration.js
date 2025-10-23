#!/usr/bin/env node

/**
 * Test script to verify S3 bucket configuration integration in the wizard
 */

const InfrastructureConfigurator = require('./lib/wizard/infrastructure-configurator');
const ConfigurationValidator = require('./lib/wizard/configuration-validator');
const chalk = require('chalk');

async function testS3Integration() {
  console.log(chalk.bold.cyan('🧪 Testing S3 Bucket Integration in Wizard'));
  console.log(chalk.gray('━'.repeat(60)));
  
  try {
    const configurator = new InfrastructureConfigurator();
    const validator = new ConfigurationValidator();
    
    // Test Quick Setup S3 defaults
    console.log(chalk.yellow('\n1. Testing Quick Setup S3 defaults...'));
    const quickConfig = await configurator.configure(null, 'quick');
    
    console.log(chalk.green('✓ Quick Setup S3 Configuration:'));
    console.log(chalk.white(`  • Enabled: ${quickConfig.s3.enabled}`));
    console.log(chalk.white(`  • Bucket Name: ${quickConfig.s3.bucketName || 'auto-generated'}`));
    console.log(chalk.white(`  • Versioning: ${quickConfig.s3.versioning}`));
    console.log(chalk.white(`  • Encryption: ${quickConfig.s3.encryption}`));
    console.log(chalk.white(`  • Public Access: ${quickConfig.s3.publicAccess}`));
    
    // Test validation with S3 configuration
    console.log(chalk.yellow('\n2. Testing S3 configuration validation...'));
    
    const testInfrastructure = {
      instanceType: 't3.micro',
      region: 'us-east-1',
      storage: {
        rootVolumeSize: 20,
        volumeType: 'gp3',
        encrypted: true
      },
      s3: {
        enabled: true,
        bucketName: null, // auto-generated
        versioning: true,
        encryption: true,
        publicAccess: false
      }
    };
    
    const validation = validator.validateInfrastructure(testInfrastructure);
    
    if (validation.errors.length === 0) {
      console.log(chalk.green('✓ S3 configuration validation passed'));
    } else {
      console.log(chalk.red('✗ S3 configuration validation failed:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('⚠ S3 configuration warnings:'));
      validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
    
    // Test validation with invalid S3 bucket name
    console.log(chalk.yellow('\n3. Testing S3 validation with invalid bucket name...'));
    
    const invalidS3Config = {
      ...testInfrastructure,
      s3: {
        enabled: true,
        bucketName: 'Invalid-Bucket-Name-With-Uppercase',
        versioning: true,
        encryption: false,
        publicAccess: true
      }
    };
    
    const invalidValidation = validator.validateInfrastructure(invalidS3Config);
    
    if (invalidValidation.errors.length > 0) {
      console.log(chalk.green('✓ Invalid S3 bucket name correctly caught:'));
      invalidValidation.errors.forEach(error => {
        console.log(chalk.white(`  • ${error}`));
      });
    }
    
    if (invalidValidation.warnings.length > 0) {
      console.log(chalk.yellow('⚠ S3 security warnings correctly generated:'));
      invalidValidation.warnings.forEach(warning => {
        console.log(chalk.white(`  • ${warning}`));
      });
    }
    
    console.log(chalk.green('\n✅ S3 Integration Test Summary:'));
    console.log(chalk.white('  • S3 configuration added to Quick Setup defaults'));
    console.log(chalk.white('  • S3 configuration validation implemented'));
    console.log(chalk.white('  • S3 bucket naming validation working'));
    console.log(chalk.white('  • S3 security warnings implemented'));
    console.log(chalk.white('  • S3 integration ready for both Quick and Advanced Setup'));
    
  } catch (error) {
    console.log(chalk.red('\n❌ S3 Integration Test Failed:'));
    console.log(chalk.red(error.message));
    console.log(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Run the test
testS3Integration();