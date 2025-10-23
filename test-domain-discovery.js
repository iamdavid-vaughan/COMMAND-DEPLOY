#!/usr/bin/env node

/**
 * Test script to verify domain discovery functionality
 * This simulates the wizard flow to test DNS domain discovery
 */

const { spawn } = require('child_process');
const path = require('path');

async function testDomainDiscovery() {
    console.log('🧪 Testing Domain Discovery Functionality...\n');
    
    const focalDeployPath = path.join(__dirname, 'bin', 'focal-deploy.js');
    
    console.log('Starting wizard with domain discovery test...');
    console.log('━'.repeat(60));
    
    // Start the wizard process
    const wizard = spawn('node', [focalDeployPath, 'new', 'test-domain-discovery'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
    });
    
    let output = '';
    let errorOutput = '';
    let inputSequence = 0;
    
    // Predefined inputs for the wizard to reach DNS configuration
    const inputs = [
        '\n',           // Choose Quick Setup (default)
        'y\n',          // Ready to begin? Yes
        'test-key\n',   // AWS Access Key ID (dummy)
        'test-secret\n', // AWS Secret Access Key (dummy)
        'us-east-1\n',  // AWS Region
        'skip\n',       // Skip GitHub (for faster testing)
        'digitalocean\n', // Choose DigitalOcean as DNS provider
        'test-do-token\n', // DigitalOcean API token (dummy)
        'n\n'           // Cancel after DNS configuration
    ];
    
    wizard.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
        
        // Auto-respond to prompts based on content
        setTimeout(() => {
            if (inputSequence < inputs.length) {
                if (text.includes('Choose your setup experience') && inputSequence === 0) {
                    console.log(`\n🤖 Selecting Quick Setup...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('Ready to begin') && inputSequence === 1) {
                    console.log(`\n🤖 Confirming ready to begin...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('AWS Access Key ID') && inputSequence === 2) {
                    console.log(`\n🤖 Entering AWS credentials...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('AWS Secret Access Key') && inputSequence === 3) {
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('AWS Region') && inputSequence === 4) {
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('GitHub') && inputSequence === 5) {
                    console.log(`\n🤖 Skipping GitHub for faster testing...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('DNS provider') && inputSequence === 6) {
                    console.log(`\n🤖 Selecting DigitalOcean as DNS provider...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('DigitalOcean API token') && inputSequence === 7) {
                    console.log(`\n🤖 Entering DigitalOcean token...`);
                    wizard.stdin.write(inputs[inputSequence++]);
                } else if (text.includes('Primary domain') || text.includes('Querying digitalocean')) {
                    console.log(`\n✅ REACHED DNS CONFIGURATION STEP!`);
                    console.log(`\n🎯 Domain discovery functionality is being tested...`);
                    
                    // Check if domain discovery is working
                    if (text.includes('Querying digitalocean for existing domains')) {
                        console.log(`\n✅ SUCCESS: Domain discovery is working!`);
                        console.log(`   - Wizard is querying DigitalOcean for domains`);
                        console.log(`   - This is the expected behavior`);
                    } else if (text.includes('Primary domain (e.g., example.com)')) {
                        console.log(`\n❌ ISSUE: Manual domain entry detected`);
                        console.log(`   - Wizard is asking for manual domain input`);
                        console.log(`   - Domain discovery may not be working properly`);
                    }
                    
                    // Cancel the wizard after testing
                    setTimeout(() => {
                        console.log(`\n🤖 Cancelling wizard after domain discovery test...`);
                        wizard.stdin.write(inputs[inputSequence++]);
                        wizard.kill('SIGTERM');
                    }, 2000);
                }
            }
        }, 500);
    });
    
    wizard.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
    });
    
    wizard.on('close', (code) => {
        console.log('\n━'.repeat(60));
        console.log(`🏁 Test completed with exit code: ${code}`);
        
        console.log('\n📊 Domain Discovery Test Results:');
        console.log('- Wizard initialization:', output.includes('Welcome to Focal-Deploy') ? '✅' : '❌');
        console.log('- DNS provider selection:', output.includes('digitalocean') ? '✅' : '❌');
        console.log('- Domain discovery attempt:', output.includes('Querying digitalocean') ? '✅' : '❌');
        console.log('- Manual domain fallback:', output.includes('Primary domain (e.g., example.com)') ? '⚠️  (fallback used)' : '✅ (no fallback needed)');
        
        // Check for the key functionality
        const domainDiscoveryWorking = output.includes('Querying digitalocean for existing domains');
        const manualFallback = output.includes('Primary domain (e.g., example.com)');
        
        if (domainDiscoveryWorking) {
            console.log('\n🎉 SUCCESS: Domain discovery functionality is integrated and working!');
            console.log('   The wizard is automatically querying DigitalOcean for domains.');
        } else if (manualFallback) {
            console.log('\n⚠️  PARTIAL: Domain discovery may have failed, falling back to manual entry.');
            console.log('   This could be due to invalid credentials or API issues.');
        } else {
            console.log('\n❌ ISSUE: Could not determine domain discovery status.');
        }
        
        process.exit(0);
    });
    
    wizard.on('error', (error) => {
        console.error('❌ Failed to start wizard process:', error.message);
        process.exit(1);
    });
    
    // Timeout after 60 seconds
    setTimeout(() => {
        console.log('\n⏰ Test timeout - killing wizard process');
        wizard.kill('SIGKILL');
        process.exit(1);
    }, 60000);
}

// Run the test
testDomainDiscovery().catch(console.error);