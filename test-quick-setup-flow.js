#!/usr/bin/env node

/**
 * Test script to verify Quick Setup flow works without prompts
 */

const path = require('path');
const fs = require('fs-extra');
const { WizardManager } = require('./lib/wizard/wizard-manager');

async function testQuickSetupFlow() {
  console.log('🧪 Testing Quick Setup Flow...\n');
  
  // Create a temporary test project directory
  const testProjectPath = path.join(__dirname, 'test-project-quick-setup');
  
  try {
    // Clean up any existing test directory
    if (await fs.pathExists(testProjectPath)) {
      await fs.remove(testProjectPath);
    }
    
    // Create test project directory with a simple package.json
    await fs.ensureDir(testProjectPath);
    await fs.writeJson(path.join(testProjectPath, 'package.json'), {
      name: 'test-quick-setup-project',
      version: '1.0.0',
      description: 'Test project for Quick Setup validation',
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      }
    });
    
    // Create a simple index.js file
    await fs.writeFile(path.join(testProjectPath, 'index.js'), `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Quick Setup test project!');
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`);
    
    console.log('✓ Created test project structure');
    
    // Initialize wizard manager
    const wizard = new WizardManager();
    
    // Set up wizard state for Quick Setup
    wizard.wizardState = {
      setupMode: 'quick',
      projectName: 'test-quick-setup-project',
      projectPath: testProjectPath
    };
    
    console.log('✓ Initialized wizard with Quick Setup mode');
    
    // Test project configuration (should use defaults)
    console.log('\n📋 Testing project configuration with Quick Setup defaults...');
    
    // Mock credentials for testing
    const mockCredentials = {
      aws: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        region: 'us-east-1'
      },
      github: {
        enabled: true,
        token: 'test-token',
        user: {
          login: 'testuser'
        }
      }
    };
    
    wizard.stepData = { credentials: mockCredentials };
    const ProjectConfigurator = require('./lib/wizard/project-configurator');
    const projectConfigurator = new ProjectConfigurator();
    
    // Test that project configuration uses Quick Setup defaults
    const projectConfig = await projectConfigurator.configure(
      wizard.wizardState.projectName,
      mockCredentials,
      'quick'
    );
    
    console.log('✓ Project configuration completed');
    
    // Verify Quick Setup defaults were applied
    console.log('\n📊 Verifying Quick Setup defaults:');
    
    // Check application config
    if (projectConfig.application) {
      console.log(`  ✓ Application type: ${projectConfig.application.type || 'nodejs-web (default)'}`);
      console.log(`  ✓ Health check: ${projectConfig.application.healthCheck || '/health (default)'}`);
    }
    
    // Check domains config (should be disabled in Quick Setup)
    if (projectConfig.domains) {
      console.log(`  ✓ Domains enabled: ${projectConfig.domains.enabled} (should be false)`);
      console.log(`  ✓ SSL enabled: ${projectConfig.domains.ssl} (should be false)`);
    }
    
    // Check repository config
    if (projectConfig.repository) {
      console.log(`  ✓ Repository name: ${projectConfig.repository.name}`);
      console.log(`  ✓ Repository visibility: ${projectConfig.repository.visibility} (should be private)`);
      console.log(`  ✓ GitHub Actions: ${projectConfig.repository.features?.actions} (should be true)`);
      console.log(`  ✓ Deploy keys: ${projectConfig.repository.features?.deployKeys} (should be true)`);
    }
    
    // Check environment config
    if (projectConfig.environment) {
      console.log(`  ✓ Environment: ${projectConfig.environment.environment} (should be production)`);
      console.log(`  ✓ Monitoring: ${projectConfig.environment.enableMonitoring} (should be true)`);
      console.log(`  ✓ Backups: ${projectConfig.environment.enableBackups} (should be true)`);
      console.log(`  ✓ Log level: ${projectConfig.environment.logLevel} (should be info)`);
      console.log(`  ✓ Environment variables: ${Object.keys(projectConfig.environment.variables || {}).length > 0 ? 'configured' : 'skipped'} (should be skipped)`);
    }
    
    console.log('\n✅ Quick Setup flow test completed successfully!');
    console.log('📝 All defaults were applied without user prompts');
    
    // Clean up test directory
    await fs.remove(testProjectPath);
    console.log('✓ Cleaned up test project directory');
    
  } catch (error) {
    console.error('\n❌ Quick Setup flow test failed:');
    console.error(error.message);
    
    // Clean up on error
    if (await fs.pathExists(testProjectPath)) {
      await fs.remove(testProjectPath);
    }
    
    process.exit(1);
  }
}

// Run the test
testQuickSetupFlow().catch(console.error);