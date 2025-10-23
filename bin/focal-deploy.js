#!/usr/bin/env node

const { Command } = require('commander');
const { Logger } = require('../lib/utils/logger');
const { ErrorHandler } = require('../lib/utils/errors');

// Import command classes
const InitCommand = require('../lib/commands/init');
const { NewCommand } = require('../lib/commands/new');
const { GitSetupCommand } = require('../lib/commands/git-setup');
const { PushDeployCommand } = require('../lib/commands/push-deploy');
const { UpCommand } = require('../lib/commands/up');
const { StatusCommand } = require('../lib/commands/status');
const { ValidateCommand } = require('../lib/commands/validate');
const { DownCommand } = require('../lib/commands/down');
const { deployCommand } = require('../lib/commands/deploy');
const { sslCommand, sslStatusCommand } = require('../lib/commands/ssl');
const { appDeployCommand, appStatusCommand, appRestartCommand, appStopCommand } = require('../lib/commands/app');
const { EnhancedStatusCommand } = require('../lib/commands/enhanced-status');
const { monitorSetupCommand, monitorStatusCommand, monitorLogsCommand } = require('../lib/commands/monitor');
const { domainConfigureCommand, domainVerifyCommand, domainStatusCommand, domainSubdomainCommand, domainWaitCommand } = require('../lib/commands/domain');
const { dnsUpdate, dnsStatus, dnsSync, dnsVerify } = require('../lib/commands/dns');
const { securitySetup, securityStatus, securityAudit, sshKeySetup, securityReset } = require('../lib/commands/security');
const { firewallStatus, fail2banStatus } = require('../lib/commands/firewall');
const { EmergencyRecoveryCommand } = require('../lib/commands/emergency-recovery');
const { ResumeCommand } = require('../lib/commands/resume');

const program = new Command();

program
  .name('focal-deploy')
  .description('Complete AWS deployment automation with wizard-based setup')
  .version('2.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize a new deployment configuration')
  .action(async () => {
    try {
      const initCommand = new InitCommand();
      await initCommand.execute();
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// New project command - Complete wizard-based setup
program
  .command('new [project-name]')
  .description('🧙‍♂️ Complete setup wizard - handles credentials, infrastructure, and deployment')
  .option('--path <directory>', 'Create project in specified directory')
  .option('--here', 'Create project in current directory')
  .option('--force', 'Overwrite existing directories')
  .option('--quiet', 'Minimal output for automation')
  .option('--resume', 'Resume from last failed deployment phase')
  .option('--no-git', 'Skip Git initialization')
  .option('--github-repo <name>', 'Custom GitHub repository name')
  .option('--private', 'Create private GitHub repository (default)')
  .option('--public', 'Create public GitHub repository')
  .option('--github-token <token>', 'GitHub personal access token')
  .option('--no-github', 'Local Git only, skip GitHub integration')
  .option('--git-user <name>', 'Git user name for commits')
  .option('--git-email <email>', 'Git user email for commits')
  .action(async (projectName, options) => {
    try {
      const newCommand = new NewCommand();
      await newCommand.execute(projectName, options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Git setup command
program
  .command('git-setup')
  .description('Configure additional Git settings for existing project')
  .option('--github-token <token>', 'GitHub personal access token')
  .option('--github-repo <name>', 'GitHub repository name')
  .option('--private', 'Create private repository')
  .option('--public', 'Create public repository')
  .action(async (options) => {
    try {
      const gitSetupCommand = new GitSetupCommand();
      await gitSetupCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Push and deploy command
program
  .command('push-deploy')
  .description('Push changes to Git and trigger EC2 deployment')
  .option('--message <msg>', 'Commit message', 'Deploy updates')
  .option('--dry-run', 'Simulate push and deployment without making changes')
  .action(async (options) => {
    try {
      const pushDeployCommand = new PushDeployCommand();
      await pushDeployCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Deploy command
program
  .command('up')
  .description('Deploy your application to AWS')
  .option('--dry-run', 'Simulate deployment without creating AWS resources')
  .action(async (options) => {
    try {
      const upCommand = new UpCommand();
      await upCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check deployment status')
  .option('--detailed', 'Show detailed status information')
  .option('--json', 'Output status in JSON format')
  .action(async (options) => {
    try {
      const statusCommand = new StatusCommand();
      await statusCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Enhanced comprehensive status command
program
  .command('status-all')
  .description('🔍 Comprehensive status check for all deployment phases')
  .option('--detailed', 'Show detailed status information')
  .option('--json', 'Output status in JSON format')
  .action(async (options) => {
    try {
      const enhancedStatusCommand = new EnhancedStatusCommand();
      await enhancedStatusCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate deployment configuration and state')
  .option('--config <path>', 'Path to configuration file')
  .option('--fix', 'Attempt to fix validation issues')
  .option('--aws', 'Validate AWS resources (requires credentials)')
  .option('--repair', 'Repair invalid state files')
  .action(async (options) => {
    try {
      const validateCommand = new ValidateCommand();
      await validateCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Add state-repair command
program
  .command('state-repair')
  .description('Repair and validate deployment state files')
  .option('--validate-aws', 'Validate AWS resources (requires credentials)')
  .option('--dry-run', 'Show what would be repaired without making changes')
  .option('--backup', 'Create backups before repairing (default: true)')
  .action(async (options) => {
    try {
      const { StateValidator } = require('../lib/utils/state-validator');
      const validator = new StateValidator();
      
      // First validate all states
      const results = await validator.validateAllStates(options);
      
      // Repair invalid states if requested
      if (results.invalid.length > 0 && !options.dryRun) {
        await validator.repairAllStates(options);
      }
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Deploy command (Docker/ECR)
program
  .command('deploy')
  .description('Build and deploy Docker container to ECR')
  .option('--dry-run', 'Simulate deployment without creating AWS resources')
  .action(async (options) => {
    try {
      await deployCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// SSL commands
program
  .command('ssl')
  .description('Set up SSL certificates with Let\'s Encrypt')
  .option('--dry-run', 'Simulate SSL setup without making changes')
  .option('--skip-dns-check', 'Skip DNS validation before SSL setup (not recommended)')
  .option('--domains <domains>', 'Comma-separated list of domains for SSL certificate')
  .option('--email <email>', 'Email address for Let\'s Encrypt registration')
  .action(async (options) => {
    try {
      await sslCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('ssl-status')
  .description('Check SSL certificate status')
  .option('--json', 'Output status in JSON format')
  .action(async (options) => {
    try {
      await sslStatusCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Application deployment commands
program
  .command('app-deploy')
  .description('Deploy application to EC2 instance')
  .option('--dry-run', 'Simulate deployment without making changes')
  .action(async (options) => {
    try {
      await appDeployCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('app-status')
  .description('Check application status')
  .option('--json', 'Output status in JSON format')
  .action(async (options) => {
    try {
      await appStatusCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('app-restart')
  .description('Restart application')
  .option('--dry-run', 'Simulate restart without making changes')
  .action(async (options) => {
    try {
      await appRestartCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('app-stop')
  .description('Stop application')
  .option('--dry-run', 'Simulate stop without making changes')
  .action(async (options) => {
    try {
      await appStopCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Monitoring commands
program
  .command('monitor-setup')
  .description('Set up health checks and monitoring')
  .option('--dry-run', 'Simulate setup without making changes')
  .action(async (options) => {
    try {
      await monitorSetupCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('monitor-status')
  .description('Check application health and system status')
  .action(async () => {
    try {
      await monitorStatusCommand();
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('monitor-logs')
  .description('Fetch application logs')
  .option('--lines <number>', 'Number of log lines to fetch', '100')
  .action(async (options) => {
    try {
      await monitorLogsCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Domain configuration commands
program
  .command('domain-configure')
  .description('Configure domain and DNS settings')
  .argument('<domain>', 'Domain name to configure')
  .option('--dry-run', 'Simulate configuration without making changes')
  .action(async (domain, options) => {
    try {
      await domainConfigureCommand(domain, options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('domain-verify')
  .description('Verify DNS configuration and SSL readiness')
  .option('--dry-run', 'Simulate verification without making changes')
  .option('--wait', 'Wait for DNS propagation before verification')
  .option('--timeout <ms>', 'Timeout for DNS verification in milliseconds', '300000')
  .action(async (options) => {
    try {
      await domainVerifyCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('domain-wait')
  .description('Wait for DNS propagation (up to 30 minutes)')
  .option('--dry-run', 'Simulate waiting without making changes')
  .option('--timeout <ms>', 'Maximum wait time in milliseconds', '1800000')
  .action(async (options) => {
    try {
      await domainWaitCommand(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('domain-status')
  .description('Check domain accessibility and SSL status')
  .argument('<domain>', 'Domain name to check')
  .action(async (domain) => {
    try {
      await domainStatusCommand(domain);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('domain-subdomain')
  .description('Configure subdomain')
  .argument('<subdomain>', 'Subdomain to configure (e.g., api.example.com)')
  .option('--dry-run', 'Simulate configuration without making changes')
  .action(async (subdomain, options) => {
    try {
      await domainSubdomainCommand(subdomain, options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// DNS automation commands
program
  .command('dns-update')
  .description('Update DNS records for all configured domains')
  .option('--dry-run', 'Simulate DNS updates without making changes')
  .action(async (options) => {
    try {
      await dnsUpdate(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('dns-status')
  .description('Check current DNS record status for all configured domains')
  .option('--target-ip <ip>', 'Specify target IP to discover additional A records')
  .action(async (options) => {
    try {
      await dnsStatus(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('dns-sync')
  .description('Force synchronization of all DNS records')
  .option('--dry-run', 'Simulate DNS sync without making changes')
  .action(async (options) => {
    try {
      await dnsSync(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('dns-verify')
  .description('Verify DNS propagation for all configured domains')
  .option('--timeout <ms>', 'Timeout for DNS verification in milliseconds', '60000')
  .option('--domain <domain>', 'Verify specific domain only')
  .action(async (options) => {
    try {
      await dnsVerify(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Security commands
program
  .command('security-setup')
  .description('Interactive security setup wizard for SSH hardening, firewall, and intrusion prevention')
  .option('--dry-run', 'Simulate security setup without making changes')
  .option('--skip-ssh', 'Skip SSH hardening configuration')
  .option('--skip-firewall', 'Skip UFW firewall configuration')
  .option('--skip-fail2ban', 'Skip Fail2ban installation and configuration')
  .option('--skip-updates', 'Skip automatic updates configuration')
  .action(async (options) => {
    try {
      await securitySetup(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('security-status')
  .description('Display comprehensive security status dashboard with health scoring')
  .action(async () => {
    try {
      await securityStatus();
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('security-audit')
  .description('Perform comprehensive security audit and vulnerability assessment')
  .option('--detailed', 'Show detailed vulnerability information')
  .action(async (options) => {
    try {
      await securityAudit(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('ssh-key-setup')
  .description('Interactive SSH key generation and deployment for secure access')
  .option('--key-type <type>', 'SSH key type (rsa, ed25519)', 'ed25519')
  .option('--key-size <size>', 'SSH key size for RSA keys', '4096')
  .option('--deploy', 'Automatically deploy generated key to server')
  .action(async (options) => {
    try {
      await sshKeySetup(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('firewall-status')
  .description('Display UFW firewall status, rules, and recent activity')
  .action(async () => {
    try {
      await firewallStatus();
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('fail2ban-status')
  .description('Display Fail2ban intrusion prevention status and banned IPs')
  .action(async () => {
    try {
      await fail2banStatus();
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('emergency-recovery')
  .description('Trigger emergency recovery via EC2 User Data (requires instance restart)')
  .option('--force', 'Skip confirmation and proceed with recovery')
  .action(async (options) => {
    try {
      const emergencyRecoveryCommand = new EmergencyRecoveryCommand();
      await emergencyRecoveryCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

program
  .command('security-reset')
  .description('Reset SSH configuration and security settings to defaults (emergency recovery)')
  .option('--force', 'Skip confirmation prompts')
  .option('--emergency', 'Emergency mode: force security group updates and aggressive recovery')
  .action(async (options) => {
    try {
      await securityReset(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Resume command
program
  .command('resume')
  .description('🔄 Resume wizard from current directory')
  .action(async (options) => {
    try {
      const resumeCommand = new ResumeCommand();
      await resumeCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Down command
program
  .command('down')
  .description('Delete all AWS resources created by this deployment')
  .option('--force', 'Skip confirmation prompts')
  .option('--skip-github', 'Skip GitHub repository cleanup')
  .action(async (options) => {
    try {
      const downCommand = new DownCommand();
      await downCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// GitHub cleanup command
program
  .command('github-cleanup')
  .description('Interactive GitHub repository cleanup tool')
  .option('--token <token>', 'GitHub personal access token')
  .option('--mode <mode>', 'Cleanup mode: smart, all, or pattern', 'smart')
  .option('--pattern <pattern>', 'Search pattern for repositories')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options) => {
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      const scriptPath = path.join(__dirname, 'github-cleanup.js');
      
      // Build command arguments
      const args = [];
      if (options.token) args.push(`--token ${options.token}`);
      if (options.mode) args.push(`--mode ${options.mode}`);
      if (options.pattern) args.push(`--pattern "${options.pattern}"`);
      if (options.dryRun) args.push('--dry-run');
      
      // Execute the GitHub cleanup script
      execSync(`node "${scriptPath}" ${args.join(' ')}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Maintenance command
program
  .command('maintenance')
  .description('Run maintenance and cleanup operations')
  .option('--check-orphans', 'Check for orphaned resources')
  .option('--validate-state', 'Validate deployment state files')
  .option('--repair', 'Attempt to repair inconsistent state')
  .option('--cleanup-temp', 'Clean up temporary files')
  .action(async (options) => {
    try {
      const { MaintenanceCommand } = require('../lib/commands/maintenance');
      const maintenanceCommand = new MaintenanceCommand();
      await maintenanceCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up orphaned resources and temporary files')
  .option('--aws', 'Clean up orphaned AWS resources')
  .option('--github', 'Clean up GitHub repositories')
  .option('--local', 'Clean up local temporary files')
  .option('--all', 'Clean up everything')
  .option('--dry-run', 'Show what would be cleaned up without actually doing it')
  .action(async (options) => {
    try {
      const { CleanupCommand } = require('../lib/commands/cleanup');
      const cleanupCommand = new CleanupCommand();
      await cleanupCommand.execute(options);
    } catch (error) {
      ErrorHandler.handle(error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}