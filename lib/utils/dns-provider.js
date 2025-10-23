const { logger } = require('./logger');
const chalk = require('chalk');

/**
 * DNS Provider Service for automatic DNS-01 challenges
 * Supports multiple DNS providers for automated certificate renewal
 */
class DNSProviderService {
  constructor() {
    this.supportedProviders = {
      cloudflare: {
        name: 'Cloudflare',
        plugin: 'certbot-dns-cloudflare',
        configFile: '/etc/letsencrypt/cloudflare.ini',
        requiredCredentials: ['apiToken', 'email']
      },
      route53: {
        name: 'AWS Route53',
        plugin: 'certbot-dns-route53',
        configFile: '/etc/letsencrypt/route53.ini',
        requiredCredentials: ['accessKeyId', 'secretAccessKey', 'region']
      },
      digitalocean: {
        name: 'DigitalOcean',
        plugin: 'certbot-dns-digitalocean',
        configFile: '/etc/letsencrypt/digitalocean.ini',
        requiredCredentials: ['token']
      },
      namecheap: {
        name: 'Namecheap',
        plugin: 'certbot-dns-namecheap',
        configFile: '/etc/letsencrypt/namecheap.ini',
        requiredCredentials: ['username', 'apiKey']
      },
      godaddy: {
        name: 'GoDaddy',
        plugin: 'certbot-dns-godaddy',
        configFile: '/etc/letsencrypt/godaddy.ini',
        requiredCredentials: ['apiKey', 'apiSecret']
      }
    };
  }

  /**
   * Check if DNS provider is configured and supported
   */
  isProviderConfigured(config) {
    if (!config.ssl?.dnsProvider) {
      return { configured: false, reason: 'No DNS provider configuration found' };
    }

    const { name, credentials } = config.ssl.dnsProvider;
    
    if (!name) {
      return { configured: false, reason: 'DNS provider name not specified' };
    }

    if (!this.supportedProviders[name]) {
      return { 
        configured: false, 
        reason: `Unsupported DNS provider: ${name}. Supported providers: ${Object.keys(this.supportedProviders).join(', ')}` 
      };
    }

    const provider = this.supportedProviders[name];
    const missingCredentials = provider.requiredCredentials.filter(cred => !credentials?.[cred]);
    
    if (missingCredentials.length > 0) {
      return { 
        configured: false, 
        reason: `Missing credentials for ${provider.name}: ${missingCredentials.join(', ')}` 
      };
    }

    return { configured: true, provider: provider, credentials };
  }

  /**
   * Install DNS provider plugin on remote server
   */
  async installDNSPlugin(host, providerName, sshService, sshOptions = {}) {
    const provider = this.supportedProviders[providerName];
    if (!provider) {
      throw new Error(`Unsupported DNS provider: ${providerName}`);
    }

    logger.info(chalk.blue(`📦 Installing ${provider.name} DNS plugin...`));

    try {
      // Install the DNS plugin using snap
      const installCommand = `sudo snap install ${provider.plugin}`;
      await sshService.executeCommand(host, installCommand, sshOptions);
      
      logger.success(chalk.green(`✅ ${provider.name} DNS plugin installed successfully`));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to install ${provider.name} DNS plugin: ${error.message}`));
      throw error;
    }
  }

  /**
   * Create DNS provider credentials file on remote server
   */
  async createCredentialsFile(host, providerName, credentials, sshService, sshOptions = {}) {
    const provider = this.supportedProviders[providerName];
    if (!provider) {
      throw new Error(`Unsupported DNS provider: ${providerName}`);
    }

    logger.info(chalk.blue(`🔐 Creating ${provider.name} credentials file...`));

    try {
      let credentialsContent = '';
      
      switch (providerName) {
        case 'cloudflare':
          credentialsContent = `# Cloudflare API credentials
dns_cloudflare_email = ${credentials.email}
dns_cloudflare_api_key = ${credentials.apiToken}`;
          break;
          
        case 'route53':
          credentialsContent = `# AWS Route53 credentials
[default]
aws_access_key_id = ${credentials.accessKeyId}
aws_secret_access_key = ${credentials.secretAccessKey}
region = ${credentials.region}`;
          break;
          
        case 'digitalocean':
          credentialsContent = `# DigitalOcean API credentials
dns_digitalocean_token = ${credentials.token}`;
          break;
          
        case 'namecheap':
          credentialsContent = `# Namecheap API credentials
dns_namecheap_username = ${credentials.username}
dns_namecheap_api_key = ${credentials.apiKey}`;
          break;
      }

      // Create the credentials file with proper permissions
      const createFileCommand = `sudo tee ${provider.configFile} > /dev/null << 'EOF'
${credentialsContent}
EOF`;
      
      await sshService.executeCommand(host, createFileCommand, sshOptions);
      
      // Set secure permissions (readable only by root)
      await sshService.executeCommand(host, `sudo chmod 600 ${provider.configFile}`, sshOptions);
      
      logger.success(chalk.green(`✅ ${provider.name} credentials file created`));
      return { success: true, configFile: provider.configFile };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to create ${provider.name} credentials file: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate Certbot command for DNS provider
   */
  generateCertbotCommand(providerName, domains, email, configFile) {
    const provider = this.supportedProviders[providerName];
    if (!provider) {
      throw new Error(`Unsupported DNS provider: ${providerName}`);
    }

    const domainFlags = domains.map(domain => `-d ${domain}`).join(' ');
    
    let dnsPlugin = '';
    let credentialsFlag = '';
    
    switch (providerName) {
      case 'cloudflare':
        dnsPlugin = '--dns-cloudflare';
        credentialsFlag = `--dns-cloudflare-credentials ${configFile}`;
        break;
        
      case 'route53':
        dnsPlugin = '--dns-route53';
        credentialsFlag = `--dns-route53-credentials ${configFile}`;
        break;
        
      case 'digitalocean':
        dnsPlugin = '--dns-digitalocean';
        credentialsFlag = `--dns-digitalocean-credentials ${configFile}`;
        break;
        
      case 'namecheap':
        dnsPlugin = '--dns-namecheap';
        credentialsFlag = `--dns-namecheap-credentials ${configFile}`;
        break;
    }

    return [
      'sudo certbot certonly',
      dnsPlugin,
      credentialsFlag,
      '--non-interactive',
      '--agree-tos',
      `--email ${email}`,
      domainFlags
    ].join(' ');
  }

  /**
   * Test DNS provider configuration
   */
  async testDNSProvider(host, providerName, domains, email, configFile, sshService, sshOptions = {}) {
    logger.info(chalk.blue(`🧪 Testing ${this.supportedProviders[providerName].name} DNS configuration...`));

    try {
      // Generate test command with --dry-run
      const testCommand = this.generateCertbotCommand(providerName, domains, email, configFile) + ' --dry-run';
      
      logger.info(chalk.gray(`Executing: ${testCommand}`));
      const result = await sshService.executeCommand(host, testCommand, sshOptions);
      
      if (result.stdout.includes('The dry run was successful') || result.stdout.includes('Congratulations')) {
        logger.success(chalk.green(`✅ DNS provider test successful`));
        return { success: true, output: result.stdout };
      } else {
        logger.warn(chalk.yellow(`⚠️  DNS provider test completed with warnings`));
        return { success: true, output: result.stdout, warnings: true };
      }
    } catch (error) {
      logger.error(chalk.red(`❌ DNS provider test failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup automatic DNS-01 challenges for a DNS provider
   */
  async setupAutomaticDNS01(host, config, domains, sshService, sshOptions = {}, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would setup automatic DNS-01 challenges for ${domains.join(', ')}`));
      return { success: true, method: 'automatic-dns-01' };
    }

    const providerCheck = this.isProviderConfigured(config);
    if (!providerCheck.configured) {
      throw new Error(`DNS provider not configured: ${providerCheck.reason}`);
    }

    const { name: providerName, credentials } = config.ssl.dnsProvider;
    const provider = providerCheck.provider;

    logger.info(chalk.blue(`🌍 Setting up automatic DNS-01 challenges using ${provider.name}...`));

    try {
      // Step 1: Install DNS plugin
      await this.installDNSPlugin(host, providerName, sshService, sshOptions);

      // Step 2: Create credentials file
      const credentialsResult = await this.createCredentialsFile(
        host, 
        providerName, 
        credentials, 
        sshService, 
        sshOptions
      );

      // Step 3: Test the configuration
      const testResult = await this.testDNSProvider(
        host, 
        providerName, 
        domains, 
        config.ssl.email, 
        credentialsResult.configFile, 
        sshService, 
        sshOptions
      );

      if (!testResult.success) {
        throw new Error(`DNS provider test failed: ${testResult.error}`);
      }

      // Step 4: Generate actual certificate
      logger.info(chalk.blue(`🔐 Generating certificate using ${provider.name}...`));
      const certCommand = this.generateCertbotCommand(
        providerName, 
        domains, 
        config.ssl.email, 
        credentialsResult.configFile
      );

      logger.info(chalk.gray(`Executing: ${certCommand}`));
      await sshService.executeCommand(host, certCommand, sshOptions);

      const primaryDomain = domains[0];
      logger.success(chalk.green(`✅ Automatic DNS-01 certificate generated successfully`));

      return {
        success: true,
        method: 'automatic-dns-01',
        provider: provider.name,
        certificatePath: `/etc/letsencrypt/live/${primaryDomain}/fullchain.pem`,
        privateKeyPath: `/etc/letsencrypt/live/${primaryDomain}/privkey.pem`,
        domains: domains,
        configFile: credentialsResult.configFile
      };

    } catch (error) {
      logger.error(chalk.red(`❌ Automatic DNS-01 setup failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Generate setup instructions for DNS provider configuration
   */
  generateSetupInstructions(providerName) {
    const provider = this.supportedProviders[providerName];
    if (!provider) {
      return `Unsupported DNS provider: ${providerName}`;
    }

    let instructions = chalk.cyan(`📋 ${provider.name} Setup Instructions:\n\n`);

    switch (providerName) {
      case 'cloudflare':
        instructions += chalk.white(`1. Log into your Cloudflare dashboard\n`);
        instructions += chalk.white(`2. Go to "My Profile" → "API Tokens"\n`);
        instructions += chalk.white(`3. Create a new token with:\n`);
        instructions += chalk.white(`   - Zone:Zone:Read permissions\n`);
        instructions += chalk.white(`   - Zone:DNS:Edit permissions\n`);
        instructions += chalk.white(`4. Add the token to your focal-deploy.yml:\n`);
        instructions += chalk.gray(`   ssl:\n`);
        instructions += chalk.gray(`     dnsProvider:\n`);
        instructions += chalk.gray(`       name: cloudflare\n`);
        instructions += chalk.gray(`       credentials:\n`);
        instructions += chalk.gray(`         apiToken: "your-api-token"\n`);
        instructions += chalk.gray(`         email: "your-cloudflare-email"\n`);
        break;

      case 'route53':
        instructions += chalk.white(`1. Create an IAM user in AWS Console\n`);
        instructions += chalk.white(`2. Attach the "Route53FullAccess" policy\n`);
        instructions += chalk.white(`3. Generate access keys for the user\n`);
        instructions += chalk.white(`4. Add the credentials to your focal-deploy.yml:\n`);
        instructions += chalk.gray(`   ssl:\n`);
        instructions += chalk.gray(`     dnsProvider:\n`);
        instructions += chalk.gray(`       name: route53\n`);
        instructions += chalk.gray(`       credentials:\n`);
        instructions += chalk.gray(`         accessKeyId: "your-access-key-id"\n`);
        instructions += chalk.gray(`         secretAccessKey: "your-secret-access-key"\n`);
        instructions += chalk.gray(`         region: "us-east-1"\n`);
        break;

      case 'digitalocean':
        instructions += chalk.white(`1. Log into your DigitalOcean account\n`);
        instructions += chalk.white(`2. Go to "API" → "Tokens/Keys"\n`);
        instructions += chalk.white(`3. Generate a new personal access token\n`);
        instructions += chalk.white(`4. Add the token to your focal-deploy.yml:\n`);
        instructions += chalk.gray(`   ssl:\n`);
        instructions += chalk.gray(`     dnsProvider:\n`);
        instructions += chalk.gray(`       name: digitalocean\n`);
        instructions += chalk.gray(`       credentials:\n`);
        instructions += chalk.gray(`         token: "your-digitalocean-token"\n`);
        break;

      case 'namecheap':
        instructions += chalk.white(`1. Log into your Namecheap account\n`);
        instructions += chalk.white(`2. Go to "Profile" → "Tools" → "Namecheap API"\n`);
        instructions += chalk.white(`3. Enable API access and get your API key\n`);
        instructions += chalk.white(`4. Add the credentials to your focal-deploy.yml:\n`);
        instructions += chalk.gray(`   ssl:\n`);
        instructions += chalk.gray(`     dnsProvider:\n`);
        instructions += chalk.gray(`       name: namecheap\n`);
        instructions += chalk.gray(`       credentials:\n`);
        instructions += chalk.gray(`         username: "your-namecheap-username"\n`);
        instructions += chalk.gray(`         apiKey: "your-namecheap-api-key"\n`);
        break;

      case 'godaddy':
        instructions += chalk.white(`1. Log into your GoDaddy Developer account at developer.godaddy.com\n`);
        instructions += chalk.white(`2. Go to "API Keys" and create a new production API key\n`);
        instructions += chalk.white(`3. Copy both the API Key and API Secret\n`);
        instructions += chalk.white(`4. Add the credentials to your focal-deploy.yml:\n`);
        instructions += chalk.gray(`   ssl:\n`);
        instructions += chalk.gray(`     dnsProvider:\n`);
        instructions += chalk.gray(`       name: godaddy\n`);
        instructions += chalk.gray(`       credentials:\n`);
        instructions += chalk.gray(`         apiKey: "your-godaddy-api-key"\n`);
        instructions += chalk.gray(`         apiSecret: "your-godaddy-api-secret"\n`);
        instructions += chalk.yellow(`\n⚠️  Note: GoDaddy requires high propagation time (≥900 seconds) for DNS changes\n`);
        break;
    }

    instructions += chalk.yellow(`\n⚠️  Important Security Notes:\n`);
    instructions += chalk.white(`• Keep your API credentials secure and never commit them to version control\n`);
    instructions += chalk.white(`• Use environment variables or secure credential storage in production\n`);
    instructions += chalk.white(`• Regularly rotate your API keys for security\n`);

    return instructions;
  }

  /**
   * List all supported DNS providers
   */
  getSupportedProviders() {
    return Object.keys(this.supportedProviders).map(key => ({
      key,
      name: this.supportedProviders[key].name,
      plugin: this.supportedProviders[key].plugin
    }));
  }
}

module.exports = { DNSProviderService };