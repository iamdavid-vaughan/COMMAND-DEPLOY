const chalk = require('chalk');
const { Logger } = require('../utils/logger');

/**
 * Configuration Validator
 * Validates all wizard configurations before deployment
 */
class ConfigurationValidator {
  constructor() {
    this.logger = new Logger('ConfigurationValidator');
  }

  /**
   * Validate all configurations
   * @param {Object} stepData - All step data from wizard
   * @returns {Object} Validation result
   */
  async validateAll(stepData) {
    const errors = [];
    const warnings = [];

    try {
      // Validate credentials
      if (stepData.credentials) {
        const credentialValidation = this.validateCredentials(stepData.credentials);
        errors.push(...credentialValidation.errors);
        warnings.push(...credentialValidation.warnings);
      }

      // Validate project configuration
      if (stepData.project) {
        const projectValidation = this.validateProject(stepData.project);
        errors.push(...projectValidation.errors);
        warnings.push(...projectValidation.warnings);
      }

      // Validate infrastructure configuration
      if (stepData.infrastructure) {
        const infraValidation = this.validateInfrastructure(stepData.infrastructure);
        errors.push(...infraValidation.errors);
        warnings.push(...infraValidation.warnings);
      }

      // Validate security configuration
      if (stepData.security) {
        const securityValidation = this.validateSecurity(stepData.security);
        errors.push(...securityValidation.errors);
        warnings.push(...securityValidation.warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: this.generateValidationSummary(stepData, errors, warnings)
      };

    } catch (error) {
      this.logger.error('Validation process failed:', error);
      return {
        valid: false,
        errors: [`Validation process failed: ${error.message}`],
        warnings: [],
        summary: 'Configuration validation could not be completed'
      };
    }
  }

  /**
   * Validate credentials
   */
  validateCredentials(credentials) {
    const errors = [];
    const warnings = [];

    // AWS credentials validation
    if (credentials.aws) {
      if (!credentials.aws.accessKeyId) {
        errors.push('AWS Access Key ID is required');
      }
      if (!credentials.aws.secretAccessKey) {
        errors.push('AWS Secret Access Key is required');
      }
      if (!credentials.aws.region) {
        errors.push('AWS region is required');
      }
    }

    // DNS credentials validation
    if (credentials.dns) {
      if (!credentials.dns.provider) {
        warnings.push('No DNS provider configured - manual DNS setup will be required');
      } else {
        switch (credentials.dns.provider) {
          case 'digitalocean':
            if (!credentials.dns.token) {
              errors.push('DigitalOcean API token is required');
            }
            break;
          case 'cloudflare':
            if (!credentials.dns.apiKey || !credentials.dns.email) {
              errors.push('Cloudflare API key and email are required');
            }
            break;
          case 'godaddy':
            if (!credentials.dns.apiKey || !credentials.dns.apiSecret) {
              errors.push('GoDaddy API key and secret are required');
            }
            break;
        }
      }
    }

    // GitHub credentials validation
    if (credentials.github) {
      if (!credentials.github.token) {
        warnings.push('No GitHub token provided - repository setup will be skipped');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate project configuration
   */
  validateProject(project) {
    const errors = [];
    const warnings = [];

    if (!project.name) {
      errors.push('Project name is required');
    }

    if (!project.type) {
      errors.push('Project type is required');
    }

    if (project.domains && project.domains.enabled) {
      if (!project.domains.primaryDomains || project.domains.primaryDomains.length === 0) {
        errors.push('At least one primary domain is required when domains are enabled');
      }

      // Validate domain format
      if (project.domains.primaryDomains) {
        project.domains.primaryDomains.forEach(domain => {
          if (!this.isValidDomain(domain)) {
            errors.push(`Invalid domain format: ${domain}`);
          }
        });
      }

      if (project.domains.ssl && project.domains.ssl.enabled && !project.domains.ssl.email) {
        errors.push('SSL email is required when SSL is enabled');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate infrastructure configuration
   */
  validateInfrastructure(infrastructure) {
    const errors = [];
    const warnings = [];

    // Check for instance type in the correct nested structure
    if (!infrastructure.instance || !infrastructure.instance.instanceType) {
      errors.push('EC2 instance type is required');
    }

    if (!infrastructure.region) {
      errors.push('AWS region is required');
    }

    if (infrastructure.storage) {
      if (infrastructure.storage.rootVolumeSize < 8) {
        warnings.push('Root volume size less than 8GB may cause issues');
      }
      if (infrastructure.storage.rootVolumeSize > 100) {
        warnings.push('Large root volume size will increase costs');
      }
    }

    // Validate S3 configuration
    if (infrastructure.s3 && infrastructure.s3.enabled) {
      if (infrastructure.s3.bucketName) {
        // Validate custom bucket name
        if (infrastructure.s3.bucketName.length < 3 || infrastructure.s3.bucketName.length > 63) {
          errors.push('S3 bucket name must be between 3 and 63 characters');
        }
        if (!/^[a-z0-9.-]+$/.test(infrastructure.s3.bucketName)) {
          errors.push('S3 bucket name can only contain lowercase letters, numbers, dots, and hyphens');
        }
        if (infrastructure.s3.bucketName.startsWith('.') || infrastructure.s3.bucketName.endsWith('.') || 
            infrastructure.s3.bucketName.startsWith('-') || infrastructure.s3.bucketName.endsWith('-')) {
          errors.push('S3 bucket name cannot start or end with dots or hyphens');
        }
        if (/\.\./.test(infrastructure.s3.bucketName)) {
          errors.push('S3 bucket name cannot contain consecutive dots');
        }
      }
      
      if (!infrastructure.s3.encryption) {
        warnings.push('S3 bucket encryption is disabled - consider enabling for security');
      }
      
      if (infrastructure.s3.publicAccess) {
        warnings.push('S3 bucket allows public access - ensure this is intentional');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate security configuration
   */
  validateSecurity(security) {
    const errors = [];
    const warnings = [];

    if (security.ssh) {
      if (!security.ssh.keyPairName) {
        errors.push('SSH key pair name is required');
      }
      
      if (security.ssh.authMethod === 'password' && !security.ssh.allowPasswordAuth) {
        warnings.push('Password-only SSH authentication is not recommended');
      }
    }

    // Check for keyPairName in firewall configuration as well (Quick Setup structure)
    if (security.firewall && !security.ssh?.keyPairName && !security.firewall.keyPairName) {
      errors.push('SSH key pair name is required');
    }

    if (security.firewall && security.firewall.enabled) {
      if (!security.firewall.allowedServices || security.firewall.allowedServices.length === 0) {
        warnings.push('No firewall services configured - server may be inaccessible');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate domain format
   */
  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain);
  }

  /**
   * Generate validation summary
   */
  generateValidationSummary(stepData, errors, warnings) {
    let summary = '';
    
    if (errors.length === 0 && warnings.length === 0) {
      summary = '✅ All configurations are valid and ready for deployment';
    } else {
      summary = `Configuration validation completed with ${errors.length} error(s) and ${warnings.length} warning(s)`;
    }

    return summary;
  }
}

module.exports = ConfigurationValidator;