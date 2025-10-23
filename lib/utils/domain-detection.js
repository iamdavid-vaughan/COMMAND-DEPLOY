const { logger } = require('./logger');
const chalk = require('chalk');

class DomainDetectionService {
  constructor() {
    this.detectedDomains = [];
    this.primaryDomain = null;
    this.aliases = [];
    this.wwwVariants = [];
    this.wildcardDomains = [];
  }

  /**
   * Detect domains from configuration and command options
   * @param {Object} config - Configuration object
   * @param {Object} options - Command options
   * @returns {Object} Domain detection result
   */
  async detectDomains(config, options = {}) {
    const { explicitDomains, includeWildcards, noWww } = options;
    
    logger.info(chalk.blue('🔍 Detecting domains for SSL certificate...'));

    // Reset state
    this.detectedDomains = [];
    this.primaryDomain = null;
    this.aliases = [];
    this.wwwVariants = [];
    this.wildcardDomains = [];

    try {
      // 1. Handle explicit domain list from command line
      if (explicitDomains && explicitDomains.length > 0) {
        return this._processExplicitDomains(explicitDomains, { includeWildcards, noWww });
      }

      // 2. Handle domains from SSL configuration in YAML
      if (config.ssl?.domains && config.ssl.domains.length > 0) {
        return this._processConfigDomains(config.ssl.domains, config.ssl, { includeWildcards, noWww });
      }

      // 3. EASY mode: Smart defaults from domain configuration
      return this._processSmartDefaults(config, { includeWildcards, noWww });

    } catch (error) {
      logger.error(chalk.red(`❌ Domain detection failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Process explicitly provided domains from command line
   * @param {Array} domains - Array of domain strings
   * @param {Object} options - Processing options
   * @returns {Object} Detection result
   */
  _processExplicitDomains(domains, options = {}) {
    logger.info(chalk.blue('📋 Processing explicitly provided domains...'));

    const domainList = Array.isArray(domains) ? domains : domains.split(',').map(d => d.trim());
    
    for (const domain of domainList) {
      if (this._isWildcardDomain(domain)) {
        this.wildcardDomains.push(domain);
        logger.info(chalk.yellow(`🌟 Wildcard domain detected: ${domain}`));
      } else {
        this.detectedDomains.push(domain);
        if (!this.primaryDomain) {
          this.primaryDomain = domain;
        } else {
          this.aliases.push(domain);
        }
      }
    }

    // Add www variants if not disabled
    if (!options.noWww) {
      this._addWwwVariants();
    }

    // Add wildcards if requested
    if (options.includeWildcards) {
      this._addWildcardVariants();
    }

    return this._buildDetectionResult('explicit');
  }

  /**
   * Process domains from SSL configuration in YAML
   * @param {Array} configDomains - Domains from config
   * @param {Object} sslConfig - SSL configuration object
   * @param {Object} options - Processing options
   * @returns {Object} Detection result
   */
  _processConfigDomains(configDomains, sslConfig, options = {}) {
    logger.info(chalk.blue('📄 Processing domains from configuration file...'));

    for (const domain of configDomains) {
      if (this._isWildcardDomain(domain)) {
        this.wildcardDomains.push(domain);
        logger.info(chalk.yellow(`🌟 Wildcard domain from config: ${domain}`));
      } else {
        this.detectedDomains.push(domain);
        if (!this.primaryDomain) {
          this.primaryDomain = domain;
        } else {
          this.aliases.push(domain);
        }
      }
    }

    // Respect SSL config settings
    const autoIncludeWww = sslConfig.auto_include_www !== false && !options.noWww;
    if (autoIncludeWww) {
      this._addWwwVariants();
    }

    // Add wildcards if configured or requested
    if (sslConfig.strategy === 'wildcard' || sslConfig.strategy === 'mixed' || options.includeWildcards) {
      this._addWildcardVariants();
    }

    return this._buildDetectionResult('config');
  }

  /**
   * Process smart defaults from domain configuration (EASY mode)
   * @param {Object} config - Full configuration object
   * @param {Object} options - Processing options
   * @returns {Object} Detection result
   */
  _processSmartDefaults(config, options = {}) {
    logger.info(chalk.blue('🎯 Using EASY mode: Smart domain detection...'));

    // Get primary domain
    if (!config.domain?.primary) {
      throw new Error('No domain configuration found. Please add domain.primary to your focal-deploy.yml file or use --domains flag.');
    }

    this.primaryDomain = config.domain.primary;
    this.detectedDomains.push(this.primaryDomain);

    logger.info(chalk.green(`✅ Primary domain: ${this.primaryDomain}`));

    // Add aliases if configured
    if (config.domain.aliases && Array.isArray(config.domain.aliases)) {
      for (const alias of config.domain.aliases) {
        if (!this._isWildcardDomain(alias)) {
          this.aliases.push(alias);
          this.detectedDomains.push(alias);
          logger.info(chalk.blue(`📎 Alias domain: ${alias}`));
        }
      }
    }

    // Auto-include www variants (default behavior in EASY mode)
    if (!options.noWww) {
      this._addWwwVariants();
      logger.info(chalk.green('✅ Auto-included www variants'));
    }

    // Add wildcards if requested
    if (options.includeWildcards) {
      this._addWildcardVariants();
      logger.info(chalk.yellow('🌟 Added wildcard variants'));
    }

    return this._buildDetectionResult('smart_defaults');
  }

  /**
   * Add www variants for all detected domains
   */
  _addWwwVariants() {
    const allDomains = [...this.detectedDomains];
    
    for (const domain of allDomains) {
      if (!domain.startsWith('www.') && !domain.startsWith('*.')) {
        const wwwDomain = `www.${domain}`;
        if (!this.detectedDomains.includes(wwwDomain)) {
          this.wwwVariants.push(wwwDomain);
          this.detectedDomains.push(wwwDomain);
        }
      }
    }
  }

  /**
   * Add wildcard variants for detected domains
   */
  _addWildcardVariants() {
    const baseDomains = [...this.detectedDomains].filter(d => !d.startsWith('www.') && !d.startsWith('*.'));
    
    for (const domain of baseDomains) {
      const wildcardDomain = `*.${domain}`;
      if (!this.wildcardDomains.includes(wildcardDomain)) {
        this.wildcardDomains.push(wildcardDomain);
      }
    }
  }

  /**
   * Check if a domain is a wildcard domain
   * @param {string} domain - Domain to check
   * @returns {boolean} True if wildcard domain
   */
  _isWildcardDomain(domain) {
    return domain.startsWith('*.');
  }

  /**
   * Build the final detection result
   * @param {string} strategy - Detection strategy used
   * @returns {Object} Detection result
   */
  _buildDetectionResult(strategy) {
    // Filter out redundant domains when wildcards are present
    const filteredDomains = this._filterRedundantDomains([
      ...this.detectedDomains,
      ...this.wildcardDomains
    ]);

    const result = {
      strategy,
      primaryDomain: this.primaryDomain,
      aliases: this.aliases,
      wwwVariants: this.wwwVariants,
      wildcardDomains: this.wildcardDomains,
      detectedDomains: this.detectedDomains,
      allDomains: filteredDomains,
      hasWildcards: this.wildcardDomains.length > 0,
      domainCount: filteredDomains.length
    };

    // Log summary
    logger.info(chalk.green(`\n📊 Domain Detection Summary:`));
    logger.info(chalk.blue(`   Strategy: ${strategy}`));
    logger.info(chalk.blue(`   Primary: ${this.primaryDomain}`));
    
    if (this.aliases.length > 0) {
      logger.info(chalk.blue(`   Aliases: ${this.aliases.join(', ')}`));
    }
    
    if (this.wwwVariants.length > 0) {
      logger.info(chalk.blue(`   WWW variants: ${this.wwwVariants.join(', ')}`));
    }
    
    if (this.wildcardDomains.length > 0) {
      logger.info(chalk.yellow(`   Wildcards: ${this.wildcardDomains.join(', ')}`));
    }
    
    logger.info(chalk.green(`   Total domains: ${filteredDomains.length}`));

    return result;
  }

  /**
   * Filter out redundant domains when wildcards are present
   * @param {Array} domains - Array of all domains
   * @returns {Array} Filtered domains without redundancy
   */
  _filterRedundantDomains(domains) {
    const wildcards = domains.filter(d => d.startsWith('*.'));
    const regular = domains.filter(d => !d.startsWith('*.'));
    
    // If no wildcards, return all domains
    if (wildcards.length === 0) {
      return domains;
    }
    
    // Filter out regular domains that would be covered by wildcards
    const filteredRegular = regular.filter(domain => {
      // Check if this domain would be redundant with any wildcard
      return !wildcards.some(wildcard => {
        const wildcardBase = wildcard.substring(2); // Remove *.
        
        // Check if domain is a subdomain of the wildcard base
        if (domain.endsWith(`.${wildcardBase}`)) {
          // www.example.com is redundant with *.example.com
          return true;
        }
        
        // Check if domain is exactly the wildcard base (not redundant)
        if (domain === wildcardBase) {
          return false;
        }
        
        return false;
      });
    });
    
    return [...filteredRegular, ...wildcards];
  }

  /**
   * Validate detected domains
   * @param {Object} detectionResult - Result from detectDomains
   * @returns {Object} Validation result
   */
  validateDomains(detectionResult) {
    const errors = [];
    const warnings = [];

    // Check for empty domain list
    if (detectionResult.allDomains.length === 0) {
      errors.push('No domains detected for SSL certificate');
    }

    // Check for invalid domain formats
    for (const domain of detectionResult.allDomains) {
      if (!this._isValidDomainFormat(domain)) {
        errors.push(`Invalid domain format: ${domain}`);
      }
    }

    // Check for wildcard limitations
    if (detectionResult.hasWildcards && detectionResult.allDomains.length > 100) {
      warnings.push('Large number of domains with wildcards may cause certificate generation issues');
    }

    // Check for mixed wildcard and specific domains
    if (detectionResult.hasWildcards && detectionResult.detectedDomains.length > 0) {
      warnings.push('Mixing wildcard and specific domains requires DNS-01 challenge method');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate domain format
   * @param {string} domain - Domain to validate
   * @returns {boolean} True if valid format
   */
  _isValidDomainFormat(domain) {
    // Basic domain validation (can be enhanced)
    const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }
}

module.exports = { DomainDetectionService };