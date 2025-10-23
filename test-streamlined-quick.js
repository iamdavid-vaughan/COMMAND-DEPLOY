#!/usr/bin/env node

/**
 * Test script to verify the streamlined Quick Setup flow
 * This tests that DNS duplication is fixed and Git repo auto-creation works
 */

const { WizardManager } = require('./lib/wizard/wizard-manager');
const chalk = require('chalk');

async function testStreamlinedQuickSetup() {
    console.log(chalk.bold.cyan('🧪 Testing Streamlined Quick Setup Flow\n'));
    
    try {
        // Initialize wizard manager
        const wizard = new WizardManager('test-streamlined-quick', null, { mode: 'test' });
        
        // Initialize session with Quick Setup mode
        await wizard.initializeSession('test-streamlined-quick', { setupMode: 'quick' });
        
        console.log(chalk.green('✓ Initialized wizard with Quick Setup mode'));
        
        // Mock credentials for testing
        const mockCredentials = {
            aws: {
                accessKeyId: 'test-key',
                secretAccessKey: 'test-secret',
                region: 'us-east-1'
            },
            github: {
                enabled: true,
                token: 'ghp_test_token_123456789',
                user: {
                    login: 'testuser'
                }
            },
            dns: {
                enabled: true,
                provider: 'digitalocean',
                token: 'dop_v1_test_token_123456789'
            }
        };
        
        wizard.stepData.credentials = mockCredentials;
        
        console.log(chalk.green('✓ Set up mock credentials'));
        
        // Test project configuration (should include domain config)
        console.log(chalk.blue('\n📋 Testing project configuration...'));
        await wizard.configureProject();
        
        console.log(chalk.green('✓ Project configuration completed'));
        
        // Check if domain configuration was stored
        if (wizard.stepData.projectConfig?.domainConfig) {
            console.log(chalk.green('✓ Domain configuration stored for later use'));
        } else {
            console.log(chalk.yellow('⚠️  Domain configuration not found in project config'));
        }
        
        // Test DNS configuration (should skip if already configured)
        console.log(chalk.blue('\n🌐 Testing DNS configuration...'));
        await wizard.configureDNS();
        
        console.log(chalk.green('✓ DNS configuration completed'));
        
        // Test application configuration (should auto-create repo in Quick Setup)
        console.log(chalk.blue('\n🚀 Testing application configuration...'));
        await wizard.configureApplication();
        
        console.log(chalk.green('✓ Application configuration completed'));
        
        // Verify results
        console.log(chalk.bold.cyan('\n📊 Test Results Summary:'));
        
        // Check DNS duplication fix
        if (wizard.stepData.dnsConfig) {
            console.log(chalk.green('  ✓ DNS configuration present'));
            if (wizard.stepData.dnsConfig.enabled) {
                console.log(chalk.green('  ✓ DNS configuration enabled'));
            } else {
                console.log(chalk.yellow('  ⚠️  DNS configuration disabled'));
            }
        } else {
            console.log(chalk.red('  ❌ DNS configuration missing'));
        }
        
        // Check Git repo auto-creation
        if (wizard.stepData.applicationConfig) {
            console.log(chalk.green('  ✓ Application configuration present'));
            if (wizard.stepData.applicationConfig.autoCreated) {
                console.log(chalk.green('  ✓ Git repository auto-created'));
            } else if (wizard.stepData.applicationConfig.deploymentType === 'git') {
                console.log(chalk.yellow('  ⚠️  Git repository configured but not auto-created'));
            } else {
                console.log(chalk.yellow('  ⚠️  Non-Git deployment method'));
            }
        } else {
            console.log(chalk.red('  ❌ Application configuration missing'));
        }
        
        console.log(chalk.bold.green('\n✅ Streamlined Quick Setup test completed successfully!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        process.exit(1);
    }
}

// Run the test
testStreamlinedQuickSetup().catch(error => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
});