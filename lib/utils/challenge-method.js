const { logger } = require('./logger');
const chalk = require('chalk');

class ChallengeMethodService {
  constructor() {
    this.challengeMethods = {};
    this.requiresManualSetup = false;
    this.dnsInstructions = [];
  }

  /**
   * Determine challenge methods for domains
   * @param {Object} domainResult - Result from domain detection
   * @param {Object} options - Challenge method options
   * @param {Object} config - Configuration object with DNS provider settings
   * @returns {Object} Challenge method result
   */
  async determineChallengeMethod(domainResult, options = {}, config = null) {
    const { challengeMethod = 'auto' } = options;
    
    logger.info(chalk.blue('🔍 Determining SSL challenge methods...'));

    // Reset state
    this.challengeMethods = {};
    this.requiresManualSetup = false;
    this.dnsInstructions = [];

    try {
      // Handle explicit challenge method override
      if (challengeMethod !== 'auto') {
        return this._processExplicitChallengeMethod(domainResult, challengeMethod);
      }

      // Auto-determine challenge methods based on domain types
      return this._processAutoChallengeMethod(domainResult, config);

    } catch (error) {
      logger.error(chalk.red(`❌ Challenge method determination failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Process explicit challenge method (user override)
   * @param {Object} domainResult - Domain detection result
   * @param {string} method - Challenge method ('http-01' or 'dns-01')
   * @returns {Object} Challenge method result
   */
  _processExplicitChallengeMethod(domainResult, method) {
    logger.info(chalk.blue(`📋 Using explicit challenge method: ${method}`));

    const validMethods = ['http-01', 'dns-01'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid challenge method: ${method}. Must be one of: ${validMethods.join(', ')}`);
    }

    // Apply the same method to all domains
    for (const domain of domainResult.allDomains) {
      this.challengeMethods[domain] = method;
    }

    // Check if manual setup is required
    if (method === 'dns-01') {
      this.requiresManualSetup = true;
      this._generateDNSInstructions(domainResult.allDomains);
      logger.warn(chalk.yellow('⚠️  DNS-01 challenge requires manual TXT record setup'));
    }

    return this._buildChallengeResult('explicit', method);
  }

  /**
   * Auto-determine challenge methods based on domain types
   * @param {Object} domainResult - Domain detection result
   * @param {Object} config - Configuration object with DNS provider settings
   * @returns {Object} Challenge method result
   */
  _processAutoChallengeMethod(domainResult, config = null) {
    logger.info(chalk.blue('🎯 Auto-determining challenge methods...'));

    let strategy = 'standard';
    const hasWildcards = domainResult.hasWildcards;
    const hasSpecificDomains = domainResult.detectedDomains.length > 0;

    // Check if DNS provider is configured for automatic DNS-01 challenges
    let dnsProviderConfigured = false;
    if (config?.ssl?.dnsProvider) {
      const { DNSProviderService } = require('./dns-provider');
      const dnsProviderService = new DNSProviderService();
      const providerCheck = dnsProviderService.isProviderConfigured(config);
      dnsProviderConfigured = providerCheck.configured;
    }

    // Determine overall strategy
    if (hasWildcards && hasSpecificDomains) {
      strategy = 'mixed';
      if (dnsProviderConfigured) {
        logger.info(chalk.green('🔄 Mixed strategy: Automatic DNS-01 for all domains (DNS provider configured)'));
      } else {
        logger.info(chalk.yellow('🔄 Mixed strategy: HTTP-01 for specific domains, manual DNS-01 for wildcards'));
      }
    } else if (hasWildcards) {
      strategy = 'wildcard';
      if (dnsProviderConfigured) {
        logger.info(chalk.green('🌟 Wildcard strategy: Automatic DNS-01 for all domains'));
      } else {
        logger.info(chalk.yellow('🌟 Wildcard strategy: Manual DNS-01 for all domains'));
      }
    } else {
      strategy = 'standard';
      logger.info(chalk.green('📡 Standard strategy: HTTP-01 for all domains'));
    }

    // Assign challenge methods based on domain types and DNS provider availability
    for (const domain of domainResult.detectedDomains) {
      if (hasWildcards && dnsProviderConfigured) {
        // Use DNS-01 for consistency when wildcards are present and DNS provider is configured
        this.challengeMethods[domain] = 'dns-01';
      } else {
        // Use HTTP-01 for non-wildcard domains when no DNS provider or no wildcards
        this.challengeMethods[domain] = 'http-01';
      }
    }

    for (const domain of domainResult.wildcardDomains) {
      this.challengeMethods[domain] = 'dns-01';
      if (!dnsProviderConfigured) {
        this.requiresManualSetup = true;
      }
    }

    // Generate DNS instructions if manual setup is needed
    if (domainResult.wildcardDomains.length > 0 && !dnsProviderConfigured) {
      this._generateDNSInstructions(domainResult.wildcardDomains);
      logger.warn(chalk.yellow('⚠️  Wildcard domains require manual DNS-01 challenge setup'));
    } else if (domainResult.wildcardDomains.length > 0 && dnsProviderConfigured) {
      logger.success(chalk.green('✅ Wildcard domains will use automatic DNS-01 challenges'));
    }

    return this._buildChallengeResult('auto', strategy);
  }

  /**
   * Generate DNS setup instructions for DNS-01 challenges
   * @param {Array} domains - Domains requiring DNS-01 challenge
   */
  _generateDNSInstructions(domains) {
    this.dnsInstructions = [];

    for (const domain of domains) {
      const baseDomain = domain.startsWith('*.') ? domain.substring(2) : domain;
      
      const instruction = {
        domain: domain,
        baseDomain: baseDomain,
        recordType: 'TXT',
        recordName: `_acme-challenge.${baseDomain}`,
        recordValue: '[CERTBOT_WILL_PROVIDE]',
        instructions: [
          `1. Log into your DNS provider (e.g., Squarespace, Cloudflare, etc.)`,
          `2. Navigate to DNS management for ${baseDomain}`,
          `3. Create a new TXT record:`,
          `   - Name: _acme-challenge`,
          `   - Value: [Will be provided by Certbot during certificate generation]`,
          `4. Wait for DNS propagation (usually 5-10 minutes)`,
          `5. Certbot will automatically verify the record`
        ]
      };

      this.dnsInstructions.push(instruction);
    }
  }

  /**
   * Build the challenge method result
   * @param {string} determinationMethod - How the method was determined
   * @param {string} strategy - Overall strategy used
   * @returns {Object} Challenge method result
   */
  _buildChallengeResult(determinationMethod, strategy) {
    const httpDomains = Object.keys(this.challengeMethods).filter(d => this.challengeMethods[d] === 'http-01');
    const dnsDomains = Object.keys(this.challengeMethods).filter(d => this.challengeMethods[d] === 'dns-01');

    const result = {
      determinationMethod,
      strategy,
      challengeMethods: { ...this.challengeMethods },
      requiresManualSetup: this.requiresManualSetup,
      dnsInstructions: [...this.dnsInstructions],
      httpDomains,
      dnsDomains,
      summary: {
        totalDomains: Object.keys(this.challengeMethods).length,
        httpCount: httpDomains.length,
        dnsCount: dnsDomains.length,
        requiresManualSetup: this.requiresManualSetup
      }
    };

    // Log summary
    logger.info(chalk.green(`\n📊 Challenge Method Summary:`));
    logger.info(chalk.blue(`   Strategy: ${strategy}`));
    logger.info(chalk.blue(`   Total domains: ${result.summary.totalDomains}`));
    
    if (httpDomains.length > 0) {
      logger.info(chalk.green(`   HTTP-01 domains (${httpDomains.length}): ${httpDomains.join(', ')}`));
    }
    
    if (dnsDomains.length > 0) {
      logger.info(chalk.yellow(`   DNS-01 domains (${dnsDomains.length}): ${dnsDomains.join(', ')}`));
    }
    
    if (this.requiresManualSetup) {
      logger.warn(chalk.yellow(`   ⚠️  Manual DNS setup required for ${dnsDomains.length} domain(s)`));
    }

    return result;
  }

  /**
   * Display DNS setup instructions to user
   * @param {Object} challengeResult - Result from determineChallengeMethod
   */
  displayDNSInstructions(challengeResult) {
    if (!challengeResult.requiresManualSetup || challengeResult.dnsInstructions.length === 0) {
      return;
    }

    logger.info(chalk.yellow('\n📋 DNS Setup Instructions:'));
    logger.info(chalk.blue('The following domains require manual DNS configuration:'));

    for (const instruction of challengeResult.dnsInstructions) {
      logger.info(chalk.yellow(`\n🌟 ${instruction.domain}:`));
      
      for (const step of instruction.instructions) {
        logger.info(chalk.gray(`   ${step}`));
      }
      
      logger.info(chalk.blue(`\n   DNS Record Details:`));
      logger.info(chalk.gray(`   - Type: ${instruction.recordType}`));
      logger.info(chalk.gray(`   - Name: ${instruction.recordName}`));
      logger.info(chalk.gray(`   - Value: ${instruction.recordValue}`));
    }

    logger.info(chalk.yellow('\n⏳ Important Notes:'));
    logger.info(chalk.gray('   - Certbot will provide the actual TXT record values during certificate generation'));
    logger.info(chalk.gray('   - You will be prompted to create these records when Certbot runs'));
    logger.info(chalk.gray('   - DNS propagation typically takes 5-10 minutes'));
    logger.info(chalk.gray('   - Some DNS providers may take longer to propagate changes'));
  }

  /**
   * Validate challenge method configuration
   * @param {Object} challengeResult - Challenge method result
   * @param {Object} domainResult - Domain detection result
   * @returns {Object} Validation result
   */
  validateChallengeConfiguration(challengeResult, domainResult) {
    const errors = [];
    const warnings = [];

    // Check if all domains have challenge methods assigned
    for (const domain of domainResult.allDomains) {
      if (!challengeResult.challengeMethods[domain]) {
        errors.push(`No challenge method assigned for domain: ${domain}`);
      }
    }

    // Check for potential issues with mixed challenges
    if (challengeResult.strategy === 'mixed') {
      warnings.push('Mixed challenge strategy may require additional DNS configuration');
    }

    // Check for wildcard limitations
    if (challengeResult.dnsDomains.length > 0) {
      warnings.push('DNS-01 challenges require manual TXT record creation');
    }

    // Check for rate limiting concerns
    if (challengeResult.summary.totalDomains > 50) {
      warnings.push('Large number of domains may hit Let\'s Encrypt rate limits');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get challenge method for a specific domain
   * @param {string} domain - Domain to check
   * @returns {string|null} Challenge method or null if not found
   */
  getChallengeMethodForDomain(domain) {
    return this.challengeMethods[domain] || null;
  }

  /**
   * Check if manual setup is required for any domain
   * @returns {boolean} True if manual setup required
   */
  isManualSetupRequired() {
    return this.requiresManualSetup;
  }

  /**
   * Get domains that require specific challenge method
   * @param {string} method - Challenge method ('http-01' or 'dns-01')
   * @returns {Array} Array of domains using the specified method
   */
  getDomainsForChallengeMethod(method) {
    return Object.keys(this.challengeMethods).filter(domain => 
      this.challengeMethods[domain] === method
    );
  }

  /**
   * Generate DNS instructions for DNS-01 challenge domains
   * @param {Array} domains - Array of domains requiring DNS-01 challenge
   * @returns {string} Formatted DNS instructions
   */
  generateDNSInstructions(domains) {
    this._generateDNSInstructions(domains);
    
    let instructions = chalk.yellow('⚠️  Manual DNS-01 Challenge Setup Required:\n\n');
    
    for (const instruction of this.dnsInstructions) {
      instructions += chalk.cyan(`🌐 Domain: ${instruction.domain}\n`);
      instructions += chalk.white(`📝 DNS Record Details:\n`);
      instructions += chalk.white(`   Type: ${instruction.recordType}\n`);
      instructions += chalk.white(`   Name: ${instruction.recordName}\n`);
      instructions += chalk.white(`   Value: ${instruction.recordValue}\n\n`);
      
      instructions += chalk.yellow('📋 Setup Instructions:\n');
      for (const step of instruction.instructions) {
        instructions += chalk.white(`   ${step}\n`);
      }
      instructions += '\n';
    }
    
    instructions += chalk.red('⚠️  Important: Complete DNS setup before proceeding with certificate generation!\n');
    instructions += chalk.blue('💡 Tip: Use `focal-deploy ssl --dry-run` to test without making changes.\n');
    
    return instructions;
  }
}

module.exports = { ChallengeMethodService };