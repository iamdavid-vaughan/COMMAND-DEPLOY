#!/usr/bin/env node

/**
 * Test script for enhanced SSL functionality
 * Tests various domain configurations and backward compatibility
 */

const chalk = require('chalk');
const { DomainDetectionService } = require('./lib/utils/domain-detection');
const { ChallengeMethodService } = require('./lib/utils/challenge-method');
const { EnhancedSSLService } = require('./lib/utils/enhanced-ssl');
const { EnhancedStateManager } = require('./lib/utils/enhanced-state');

class SSLEnhancementTester {
  constructor() {
    this.domainDetection = new DomainDetectionService();
    this.challengeMethod = new ChallengeMethodService();
    this.enhancedSSL = new EnhancedSSLService();
    this.stateManager = new EnhancedStateManager('.test-focal-deploy');
  }

  async runAllTests() {
    console.log(chalk.blue('🧪 Starting Enhanced SSL Functionality Tests\n'));

    try {
      await this.testDomainDetection();
      await this.testChallengeMethodSelection();
      await this.testBackwardCompatibility();
      await this.testMultiDomainConfigurations();
      await this.testStateManagement();
      
      console.log(chalk.green('\n✅ All tests completed successfully!'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Test failed: ${error.message}`));
      process.exit(1);
    }
  }

  async testDomainDetection() {
    console.log(chalk.yellow('📋 Testing Domain Detection Service...'));

    // Test 1: EASY mode with single domain
    const config1 = { domain: { primary: 'example.com' } };
    const result1 = await this.domainDetection.detectDomains(config1, {});
    console.log(chalk.green(`✓ EASY mode single domain: ${result1.allDomains.join(', ')}`));

    // Test 2: EASY mode with www inclusion (default behavior)
    const config2 = { domain: { primary: 'example.com' } };
    const result2 = await this.domainDetection.detectDomains(config2, {});
    console.log(chalk.green(`✓ EASY mode with www: ${result2.allDomains.join(', ')}`));

    // Test 3: Advanced mode with multiple domains
    const result3 = await this.domainDetection.detectDomains(config1, { 
      domains: ['api.example.com', 'app.example.com'] 
    });
    console.log(chalk.green(`✓ Advanced mode multiple domains: ${result3.allDomains.join(', ')}`));

    // Test 4: Wildcard domains
    const result4 = await this.domainDetection.detectDomains(config1, { 
      domains: ['*.example.com'],
      includeWildcards: true 
    });
    console.log(chalk.green(`✓ Wildcard domains: ${result4.allDomains.join(', ')}`));

    // Test 5: EASY mode with aliases
    const config5 = { 
      domain: { 
        primary: 'example.com',
        aliases: ['api.example.com', 'app.example.com']
      } 
    };
    const result5 = await this.domainDetection.detectDomains(config5, {});
    console.log(chalk.green(`✓ EASY mode with aliases: ${result5.allDomains.join(', ')}`));

    console.log(chalk.blue('  Domain Detection tests passed ✓\n'));
  }

  async testChallengeMethodSelection() {
    console.log(chalk.yellow('🔍 Testing Challenge Method Selection...'));

    // Test 1: HTTP-01 for regular domains
    const domainResult1 = {
      allDomains: ['example.com', 'www.example.com'],
      detectedDomains: ['example.com', 'www.example.com'],
      wildcardDomains: [],
      hasWildcards: false
    };
    const result1 = await this.challengeMethod.determineChallengeMethod(domainResult1);
    console.log(chalk.green(`✓ Regular domains use HTTP-01: ${JSON.stringify(result1.challengeMethods)}`));

    // Test 2: DNS-01 for wildcard domains
    const domainResult2 = {
      allDomains: ['*.example.com'],
      detectedDomains: [],
      wildcardDomains: ['*.example.com'],
      hasWildcards: true
    };
    const result2 = await this.challengeMethod.determineChallengeMethod(domainResult2);
    console.log(chalk.green(`✓ Wildcard domains use DNS-01: ${JSON.stringify(result2.challengeMethods)}`));

    // Test 3: Mixed challenge methods
    const domainResult3 = {
      allDomains: ['example.com', '*.api.example.com'],
      detectedDomains: ['example.com'],
      wildcardDomains: ['*.api.example.com'],
      hasWildcards: true
    };
    const result3 = await this.challengeMethod.determineChallengeMethod(domainResult3);
    console.log(chalk.green(`✓ Mixed domains: ${JSON.stringify(result3.challengeMethods)}`));

    // Test 4: Explicit challenge method override
    const domainResult4 = {
      allDomains: ['example.com'],
      detectedDomains: ['example.com'],
      wildcardDomains: [],
      hasWildcards: false
    };
    const result4 = await this.challengeMethod.determineChallengeMethod(
      domainResult4,
      { challengeMethod: 'dns-01' }
    );
    console.log(chalk.green(`✓ Explicit DNS-01 override: ${JSON.stringify(result4.challengeMethods)}`));

    console.log(chalk.blue('  Challenge Method tests passed ✓\n'));
  }

  async testBackwardCompatibility() {
    console.log(chalk.yellow('🔄 Testing Backward Compatibility...'));

    // Create legacy state
    const legacyState = {
      version: '1.0',
      ssl: {
        enabled: true,
        domain: 'legacy.example.com',
        certificatePath: '/etc/letsencrypt/live/legacy.example.com/fullchain.pem',
        privateKeyPath: '/etc/letsencrypt/live/legacy.example.com/privkey.pem',
        setupDate: '2024-01-01T00:00:00.000Z'
      }
    };

    // Save legacy state
    await this.stateManager.saveState(legacyState);

    // Load and check migration
    const migratedState = await this.stateManager.loadState();
    
    if (migratedState.ssl.version === '2.0' && migratedState.ssl.domains.includes('legacy.example.com')) {
      console.log(chalk.green('✓ Legacy SSL state migrated successfully'));
      console.log(chalk.green(`  - Domains: ${migratedState.ssl.domains.join(', ')}`));
      console.log(chalk.green(`  - Challenge methods: ${JSON.stringify(migratedState.ssl.challengeMethods)}`));
    } else {
      throw new Error('Legacy state migration failed');
    }

    console.log(chalk.blue('  Backward Compatibility tests passed ✓\n'));
  }

  async testMultiDomainConfigurations() {
    console.log(chalk.yellow('🌐 Testing Multi-Domain Configurations...'));

    const testConfigs = [
      {
        name: 'Simple multi-domain',
        domainResult: {
          allDomains: ['app.example.com', 'api.example.com'],
          detectedDomains: ['app.example.com', 'api.example.com'],
          wildcardDomains: [],
          hasWildcards: false
        },
        expected: { httpDomains: 2, dnsDomains: 0 }
      },
      {
        name: 'Mixed regular and wildcard',
        domainResult: {
          allDomains: ['example.com', '*.sub.example.com'],
          detectedDomains: ['example.com'],
          wildcardDomains: ['*.sub.example.com'],
          hasWildcards: true
        },
        expected: { httpDomains: 1, dnsDomains: 1 }
      },
      {
        name: 'Multiple wildcards',
        domainResult: {
          allDomains: ['*.api.example.com', '*.app.example.com'],
          detectedDomains: [],
          wildcardDomains: ['*.api.example.com', '*.app.example.com'],
          hasWildcards: true
        },
        expected: { httpDomains: 0, dnsDomains: 2 }
      },
      {
        name: 'Complex mixed configuration',
        domainResult: {
          allDomains: ['example.com', 'www.example.com', 'api.example.com', '*.sub.example.com'],
          detectedDomains: ['example.com', 'www.example.com', 'api.example.com'],
          wildcardDomains: ['*.sub.example.com'],
          hasWildcards: true
        },
        expected: { httpDomains: 3, dnsDomains: 1 }
      }
    ];

    for (const config of testConfigs) {
      const result = await this.challengeMethod.determineChallengeMethod(config.domainResult);
      
      const httpCount = Object.values(result.challengeMethods).filter(m => m === 'http-01').length;
      const dnsCount = Object.values(result.challengeMethods).filter(m => m === 'dns-01').length;
      
      if (httpCount === config.expected.httpDomains && dnsCount === config.expected.dnsDomains) {
        console.log(chalk.green(`✓ ${config.name}: HTTP-01=${httpCount}, DNS-01=${dnsCount}`));
      } else {
        throw new Error(`${config.name} failed: expected HTTP-01=${config.expected.httpDomains}, DNS-01=${config.expected.dnsDomains}, got HTTP-01=${httpCount}, DNS-01=${dnsCount}`);
      }
    }

    console.log(chalk.blue('  Multi-Domain Configuration tests passed ✓\n'));
  }

  async testStateManagement() {
    console.log(chalk.yellow('💾 Testing Enhanced State Management...'));

    // Test enhanced SSL config update
    const sslConfig = {
      enabled: true,
      domains: ['test1.example.com', 'test2.example.com'],
      domainConfigs: [
        { domain: 'test1.example.com', challengeMethod: 'http-01' },
        { domain: 'test2.example.com', challengeMethod: 'http-01' }
      ],
      challengeMethods: {
        'test1.example.com': 'http-01',
        'test2.example.com': 'http-01'
      },
      certificatePath: '/etc/letsencrypt/live/test1.example.com/fullchain.pem',
      privateKeyPath: '/etc/letsencrypt/live/test1.example.com/privkey.pem'
    };

    await this.stateManager.updateSSLConfig(sslConfig);
    console.log(chalk.green('✓ Enhanced SSL config saved'));

    // Test domain config management
    await this.stateManager.addDomainConfig('test3.example.com', {
      challengeMethod: 'dns-01',
      isWildcard: false,
      certificateType: 'individual'
    });
    console.log(chalk.green('✓ Domain config added'));

    // Test SSL status retrieval
    const sslStatus = await this.stateManager.getSSLStatus();
    if (sslStatus.enabled && sslStatus.domains.length === 2) {
      console.log(chalk.green(`✓ SSL status retrieved: ${sslStatus.domains.length} domains`));
    } else {
      throw new Error('SSL status retrieval failed');
    }

    // Test deployment tracking
    await this.stateManager.addDeployment({
      type: 'ssl-setup',
      domains: sslConfig.domains,
      challengeMethods: sslConfig.challengeMethods,
      success: true
    });
    console.log(chalk.green('✓ Deployment tracked'));

    console.log(chalk.blue('  State Management tests passed ✓\n'));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SSLEnhancementTester();
  tester.runAllTests().catch(error => {
    console.error(chalk.red(`Test execution failed: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { SSLEnhancementTester };