const { UpCommand } = require('../commands/up');
const { Logger } = require('../utils/logger');
const { SSLCertificateService } = require('../services/ssl-certificate-service');
const { SecurityHardeningService } = require('../services/security-hardening-service');
const { DNSManagementService } = require('../services/dns-management-service');
const { ApplicationDeploymentService } = require('../services/application-deployment-service');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class DeploymentExecutor {
  constructor() {
    this.upCommand = new UpCommand();
    this.sslService = new SSLCertificateService();
    this.securityService = new SecurityHardeningService();
    this.dnsService = new DNSManagementService();
    this.applicationService = new ApplicationDeploymentService();
    
    // Define deployment phases
    this.phases = [
      { name: 'infrastructure', description: 'Infrastructure Setup' },
      { name: 'security', description: 'Security Hardening' },
      { name: 'dns', description: 'DNS Configuration' },
      { name: 'ssl', description: 'SSL Certificate Setup' },
      { name: 'application', description: 'Application Deployment' }
    ];
  }

  /**
   * Generate unique SSH key pair name for the project
   */
  generateUniqueKeyPairName(projectName) {
    const sanitizedName = (projectName || 'focal-deploy-project').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const timestamp = Date.now();
    return `${sanitizedName}-keypair-${timestamp}`;
  }

  /**
   * Generate unique security group name for the project
   */
  generateUniqueSecurityGroupName(projectName) {
    const sanitizedName = (projectName || 'focal-deploy-project').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const timestamp = Date.now();
    return `${sanitizedName}-sg-${timestamp}`;
  }

  /**
   * Save deployment state to disk for resume functionality
   */
  async saveDeploymentState(projectPath, state) {
    const stateDir = path.join(projectPath, '.focal-deploy', 'deployment');
    await fs.ensureDir(stateDir);
    
    const statePath = path.join(stateDir, 'deployment-state.json');
    await fs.writeJson(statePath, {
      ...state,
      lastUpdated: new Date().toISOString()
    }, { spaces: 2 });
    
    Logger.info(chalk.gray(`💾 Deployment state saved`));
  }

  /**
   * Load deployment state from disk
   */
  async loadDeploymentState(projectPath) {
    const statePath = path.join(projectPath, '.focal-deploy', 'deployment', 'deployment-state.json');
    
    if (await fs.pathExists(statePath)) {
      const state = await fs.readJson(statePath);
      Logger.info(chalk.gray(`📋 Loaded deployment state from ${state.lastUpdated}`));
      return state;
    }
    
    return null;
  }

  /**
   * Clear deployment state after successful completion
   */
  async clearDeploymentState(projectPath) {
    const statePath = path.join(projectPath, '.focal-deploy', 'deployment', 'deployment-state.json');
    
    if (await fs.pathExists(statePath)) {
      await fs.remove(statePath);
      Logger.info(chalk.gray(`🗑️  Deployment state cleared`));
    }
  }

  /**
   * Check if deployment can be resumed
   */
  async canResumeDeployment(projectPath) {
    const state = await this.loadDeploymentState(projectPath);
    return state && state.currentPhase && !state.completed;
  }

  /**
   * Resume deployment from the last failed phase
   */
  async resumeDeployment(projectPath, stepData) {
    const state = await this.loadDeploymentState(projectPath);
    
    if (!state) {
      throw new Error('No deployment state found to resume from');
    }
    
    Logger.info(chalk.bold.yellow(`\n🔄 Resuming deployment from phase: ${state.currentPhase}`));
    Logger.info(chalk.gray(`Last attempt: ${state.lastUpdated}`));
    
    // Find the phase index to resume from
    const phaseIndex = this.phases.findIndex(p => p.name === state.currentPhase);
    if (phaseIndex === -1) {
      throw new Error(`Unknown phase: ${state.currentPhase}`);
    }
    
    // Execute deployment starting from the failed phase
    return await this.executeFromPhase(projectPath, stepData, phaseIndex, state);
  }

  /**
   * Execute deployment using the wizard configuration
   * @param {string} projectPath - Path to the project directory
   * @param {object} stepData - Configuration data from wizard steps
   * @returns {object} Deployment results
   */
  async execute(projectPath, stepData) {
    // Check if we can resume an existing deployment
    if (await this.canResumeDeployment(projectPath)) {
      const { resume } = await require('inquirer').prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: '🔄 Previous deployment detected. Resume from last failed phase?',
          default: true
        }
      ]);
      
      if (resume) {
        return await this.resumeDeployment(projectPath, stepData);
      } else {
        // Clear existing state and start fresh
        await this.clearDeploymentState(projectPath);
      }
    }
    
    // Start fresh deployment
    return await this.executeFromPhase(projectPath, stepData, 0);
  }

  /**
   * Execute deployment starting from a specific phase
   */
  async executeFromPhase(projectPath, stepData, startPhaseIndex = 0, existingState = null) {
    // Change to project directory for deployment
    const originalCwd = process.cwd();
    
    // Initialize deployment state outside try block to ensure it's accessible in catch
    let deploymentState = existingState || {
      sessionId: require('uuid').v4(),
      startedAt: new Date().toISOString(),
      currentPhase: null,
      completedPhases: [],
      deploymentResults: {},
      sshOptions: null,
      completeConfig: null,
      completed: false
    };
    
    try {
      Logger.info(chalk.bold.cyan('\n🚀 Complete Deployment Execution'));
      Logger.info(chalk.gray('Orchestrating infrastructure, security, DNS, SSL, and application deployment'));
      
      // Save the wizard configuration to the expected location
      await this.saveWizardConfiguration(projectPath, stepData);
      
      process.chdir(projectPath);
      
      // Execute phases starting from the specified index
      for (let i = startPhaseIndex; i < this.phases.length; i++) {
        const phase = this.phases[i];
        deploymentState.currentPhase = phase.name;
        
        Logger.info(chalk.bold.blue(`\n📋 Phase ${i + 1}: ${phase.description}`));
        
        // Save state before executing phase
        await this.saveDeploymentState(projectPath, deploymentState);
        
        // Execute the specific phase
        const phaseResult = await this.executePhase(
          phase.name, 
          projectPath, 
          stepData, 
          deploymentState
        );
        
        // Update deployment state with results
        deploymentState.deploymentResults[phase.name] = phaseResult;
        deploymentState.completedPhases.push(phase.name);
        
        // Save state after successful phase completion
        await this.saveDeploymentState(projectPath, deploymentState);
        
        Logger.success(chalk.green(`✅ Phase ${i + 1} (${phase.description}) completed successfully`));
      }
      
      // Mark deployment as completed
      deploymentState.completed = true;
      deploymentState.completedAt = new Date().toISOString();
      
      // Generate final deployment information
      const deploymentInfo = await this.generateDeploymentInfo(stepData, deploymentState.deploymentResults);
      
      // Save the complete configuration with all deployment details
      const configPath = path.join(projectPath, '.focal-deploy', 'config.json');
      await fs.writeJson(configPath, deploymentState.completeConfig, { spaces: 2 });
      
      // Clear deployment state since we completed successfully
      await this.clearDeploymentState(projectPath);
      
      Logger.success(chalk.bold.green('\n🎉 Complete Deployment Successful!'));
      Logger.info(chalk.green('====================================='));
      this.displayDeploymentSummary(deploymentInfo);
      
      return {
        success: true,
        phases: deploymentState.deploymentResults,
        ...deploymentInfo
      };
      
    } catch (error) {
      Logger.error(chalk.red(`❌ Deployment failed during phase: ${deploymentState?.currentPhase || 'unknown'}`));
      Logger.error(chalk.red(`Error: ${error.message}`));
      
      // Save the failed state for potential resume
      if (deploymentState) {
        deploymentState.lastError = {
          message: error.message,
          phase: deploymentState.currentPhase,
          timestamp: new Date().toISOString()
        };
        await this.saveDeploymentState(projectPath, deploymentState);
        
        Logger.info(chalk.yellow(`\n💾 Deployment state saved. You can resume with:`));
        Logger.info(chalk.cyan(`   focal-deploy new --resume`));
      }
      
      throw error;
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }

  /**
   * Execute a specific deployment phase
   */
  async executePhase(phaseName, projectPath, stepData, deploymentState) {
    switch (phaseName) {
      case 'infrastructure':
        return await this.executeInfrastructurePhase(projectPath, stepData, deploymentState);
      case 'security':
        return await this.executeSecurityPhase(projectPath, stepData, deploymentState);
      case 'dns':
        return await this.executeDNSPhase(projectPath, stepData, deploymentState);
      case 'ssl':
        return await this.executeSSLPhase(projectPath, stepData, deploymentState);
      case 'application':
        return await this.executeApplicationPhase(projectPath, stepData, deploymentState);
      default:
        throw new Error(`Unknown deployment phase: ${phaseName}`);
    }
  }

  /**
   * Execute infrastructure phase
   */
  async executeInfrastructurePhase(projectPath, stepData, deploymentState) {
    const infrastructureResult = await this.upCommand.execute({
      skipConfirmation: true,
      quiet: false
    });
    
    // Debug logging to see what we received from UpCommand
    Logger.info(chalk.gray('Infrastructure result from UpCommand:'));
    Logger.info(chalk.gray(JSON.stringify(infrastructureResult, null, 2)));
    
    // Update configuration with infrastructure details immediately after creation
    await this.updateConfigWithInfrastructure(projectPath, infrastructureResult);
    
    // Get the complete configuration with infrastructure details
    const completeConfig = await this.buildCompleteConfig(projectPath, stepData, infrastructureResult);
    deploymentState.completeConfig = completeConfig;
    
    return infrastructureResult;
  }

  /**
   * Execute security phase
   */
  async executeSecurityPhase(projectPath, stepData, deploymentState) {
    const completeConfig = deploymentState.completeConfig;

    // CRITICAL FIX: Check if we're resuming by loading saved security state
    // Load the security state to check if SSH hardening was partially completed
    const { StateManager } = require('../utils/state');
    const stateManager = new StateManager();
    let savedSecurityState = null;
    let instanceId = null;

    try {
      const state = await stateManager.loadState();

      // Get instanceId from state resources or config
      instanceId = state?.resources?.ec2Instance?.instanceId ||
                   completeConfig.infrastructure?.ec2Instance?.instanceId ||
                   deploymentState.deploymentResults?.infrastructure?.instanceId;

      Logger.info(chalk.gray(`🔍 Resume check - Instance ID: ${instanceId}`));
      Logger.info(chalk.gray(`🔍 State security section exists: ${!!state?.security}`));

      if (instanceId && state?.security?.[instanceId]) {
        Logger.info(chalk.gray(`🔍 Found security state for instance ${instanceId}`));
        Logger.info(chalk.gray(`🔍 Security state: ${JSON.stringify(state.security[instanceId], null, 2)}`));
        savedSecurityState = state.security[instanceId].ssh;
      } else {
        Logger.info(chalk.gray(`🔍 No security state found for instance ${instanceId}`));
      }
    } catch (error) {
      Logger.info(chalk.gray(`🔍 Error loading state: ${error.message}`));
      // No saved state, continue with fresh deployment
    }

    // Check if we're resuming with existing SSH configuration
    const isResuming = (deploymentState.sshOptions && deploymentState.sshOptions.sshHardeningApplied) ||
                       (savedSecurityState && savedSecurityState.sshHardeningApplied && savedSecurityState.customPort);

    Logger.info(chalk.gray(`🔍 Resume detection result: ${isResuming}`));
    Logger.info(chalk.gray(`🔍 deploymentState.sshOptions: ${JSON.stringify(deploymentState.sshOptions || {}, null, 2)}`));
    Logger.info(chalk.gray(`🔍 savedSecurityState: ${JSON.stringify(savedSecurityState || {}, null, 2)}`));

    // CRITICAL FIX: Check if we're in a deployment resume scenario
    // If deployment failed after Phase 4 but state wasn't saved (e.g., due to crash),
    // we should still attempt to use the custom port from config
    const isDeploymentResume = deploymentState.currentPhase === 'security' &&
                                deploymentState.lastError;

    if (isDeploymentResume && !isResuming) {
      Logger.info(chalk.yellow(`⚠️  Detected deployment resume without security state`));
      Logger.info(chalk.yellow(`⚠️  Port 22 may be closed. Will attempt custom port ${completeConfig.infrastructure?.sshPort || 9022} as fallback`));

      // Build SSH options using the configured custom port
      const fallbackPort = completeConfig.infrastructure?.sshPort || 9022;
      const fallbackUsername = completeConfig.security?.ssh?.deploymentUser ||
                               (completeConfig.infrastructure?.operatingSystem === 'debian' ? 'admin' : 'ubuntu');

      const fallbackSSHOptions = {
        privateKeyPath: completeConfig.aws?.keyPath,
        operatingSystem: completeConfig.infrastructure?.operatingSystem || 'ubuntu',
        username: fallbackUsername,
        deploymentUser: fallbackUsername,
        port: fallbackPort,
        customPort: fallbackPort,
        sshHardeningApplied: true, // Assume Phase 4 completed
        infrastructureSSHPort: 22, // Keep port 22 for security group cleanup
        attemptPortFallback: true, // Flag to indicate we're trying fallback
        region: completeConfig.aws?.region,
        credentials: completeConfig.aws?.credentials,
        securityGroupId: completeConfig.infrastructure?.securityGroup?.id
      };

      Logger.info(chalk.yellow(`🔄 Using fallback SSH configuration`));
      Logger.info(chalk.gray(`   Port: ${fallbackPort}`));
      Logger.info(chalk.gray(`   Username: ${fallbackUsername}`));
      Logger.info(chalk.gray(`   Key: ${completeConfig.aws?.keyPath}`));

      const securityResult = await this.securityService.hardenSecurity(
        completeConfig,
        fallbackSSHOptions
      );

      deploymentState.sshOptions = fallbackSSHOptions;
      deploymentState.completeConfig = completeConfig;

      return securityResult;
    }

    if (isResuming) {
      // Use saved security state to rebuild SSH options
      const resumePort = savedSecurityState?.customPort || deploymentState.sshOptions?.customPort || 9022;
      const resumeUsername = savedSecurityState?.username || deploymentState.sshOptions?.username || 'deploy';

      Logger.info(chalk.yellow(`🔄 Resuming security phase with existing SSH configuration`));
      Logger.info(chalk.gray(`Detected completed phase: Phase ${savedSecurityState?.phaseCompleted || '4'}`));
      Logger.info(chalk.gray(`Current SSH port: ${resumePort}, User: ${resumeUsername}`));

      // Rebuild SSH options from saved state
      const resumeSSHOptions = {
        privateKeyPath: completeConfig.aws?.keyPath || deploymentState.sshOptions?.privateKeyPath,
        operatingSystem: completeConfig.infrastructure?.operatingSystem || 'ubuntu',
        username: resumeUsername,
        deploymentUser: resumeUsername,
        port: resumePort, // Use the custom port, not 22
        customPort: resumePort,
        sshHardeningApplied: true, // Mark as already applied
        region: completeConfig.aws?.region,
        credentials: completeConfig.aws?.credentials,
        securityGroupId: completeConfig.infrastructure?.securityGroup?.id || deploymentState.deploymentResults?.infrastructure?.securityGroupId
      };

      Logger.info(chalk.gray(`Resume SSH options: port=${resumeSSHOptions.port}, username=${resumeSSHOptions.username}, hardening=${resumeSSHOptions.sshHardeningApplied}`));

      // Use the rebuilt SSH options from saved state
      const securityResult = await this.securityService.hardenSecurity(
        completeConfig,
        resumeSSHOptions
      );

      // Update deployment state with results
      deploymentState.sshOptions = resumeSSHOptions;
      deploymentState.completeConfig = completeConfig;

      return securityResult;
    }

    // Build SSH options for security hardening (fresh deployment)
    // Use the configured OS from the infrastructure configuration
    let operatingSystem = completeConfig.infrastructure?.operatingSystem || 'ubuntu';
    
    // CRITICAL FIX: Use the configured OS instead of trying to detect it
    // The user has already specified the OS during setup, so we should respect that
    Logger.info(`ℹ️ Using configured operating system: ${operatingSystem}`);
    
    // Skip OS detection if the OS is already configured
    // This prevents overriding the user's explicit configuration
    if (completeConfig.infrastructure?.operatingSystem) {
      Logger.info(`✅ Using configured operating system: ${operatingSystem}`);
    } else {
      // Only try to detect if no OS is configured
      if (completeConfig.infrastructure?.ec2Instance?.instanceId && completeConfig.infrastructure?.ec2Instance?.publicIpAddress) {
        try {
          const OSDetector = require('../utils/os-detector');
          const osDetector = new OSDetector(completeConfig);
          
          // Try multiple detection methods with proper SSH parameters
          // Check if SSH hardening has been completed by looking at deployment state
          const isSSHHardened = deploymentState?.completedPhases?.includes('security') || 
                                deploymentState?.sshOptions?.customPort ||
                                deploymentState?.deploymentResults?.security?.ssh?.success;
          
          const sshConnectionParams = {
            privateKey: completeConfig.aws?.keyPath ? require('fs').readFileSync(completeConfig.aws.keyPath, 'utf8') : null,
            port: isSSHHardened ? 
              (deploymentState.sshOptions?.customPort || deploymentState.sshOptions?.port || completeConfig.infrastructure?.sshPort || 9022) :
              (completeConfig.infrastructure?.sshPort || 22),
            username: isSSHHardened ?
              (deploymentState.sshOptions?.deploymentUser || deploymentState.sshOptions?.username || completeConfig.security?.ssh?.deploymentUser) :
              (completeConfig.security?.ssh?.deploymentUser || (operatingSystem === 'debian' ? 'admin' : 'ubuntu'))
          };
          
          const detectedOS = await osDetector.detectOperatingSystem(
            completeConfig.infrastructure.ec2Instance.instanceId,
            completeConfig.infrastructure.ec2Instance.publicIpAddress,
            sshConnectionParams
          );
          
          if (detectedOS && detectedOS !== 'unknown') {
            operatingSystem = detectedOS;
            Logger.info(`✅ Detected operating system: ${operatingSystem}`);
          } else {
            Logger.warn(`⚠️ Could not detect OS, falling back to ${operatingSystem} default`);
          }
        } catch (error) {
          Logger.warn(`⚠️ Could not detect OS, falling back to ${operatingSystem} default`);
        }
      }
    }
    
    const defaultUsername = operatingSystem === 'debian' ? 'admin' : 'ubuntu';
    const deploymentUser = completeConfig.security?.ssh?.deploymentUser || defaultUsername;
    
    // CRITICAL FIX: Use the custom deployment user for SSH connections
    // The wizard allows users to set a custom username (like 'davidvaughan')
    // We should use this custom username for SSH connections, not the OS default
    const sshUsername = deploymentUser !== defaultUsername ? deploymentUser : defaultUsername;
    
    // CRITICAL FIX: Use the infrastructure's configured SSH port for initial connection
    // The infrastructure may already be configured for a custom port (like 9022) from the start
    const infrastructureSSHPort = completeConfig.infrastructure?.sshPort || deploymentState.deploymentResults.infrastructure?.sshPort || 22;
    const targetCustomPort = completeConfig.securityConfig?.sshHardening?.customPort || infrastructureSSHPort || 9022;
    
    const sshOptions = {
      privateKeyPath: completeConfig.aws?.keyPath,
      operatingSystem: operatingSystem,
      username: sshUsername,  // Use custom deployment user if set, otherwise OS default
      deploymentUser: deploymentUser,  // Target deployment user after hardening
      port: infrastructureSSHPort,  // Use infrastructure's configured SSH port for initial connection
      customPort: targetCustomPort,  // Target port after hardening
      region: completeConfig.aws?.region,
      credentials: completeConfig.aws?.credentials,
      securityGroupId: completeConfig.infrastructure?.securityGroup?.id || deploymentState.deploymentResults.infrastructure?.securityGroupId
    };
    
    const securityResult = await this.securityService.hardenSecurity(completeConfig, sshOptions);
    
    // CRITICAL FIX: Update SSH connection parameters after hardening for subsequent phases
    if (securityResult?.ssh?.success && securityResult.ssh.customPort) {
      // Update sshOptions for subsequent phases
      sshOptions.port = securityResult.ssh.customPort;
      sshOptions.customPort = securityResult.ssh.customPort;
      sshOptions.username = securityResult.ssh.username;
      
      // Update completeConfig to reflect the new SSH parameters
      if (completeConfig.infrastructure) {
        completeConfig.infrastructure.sshPort = securityResult.ssh.customPort;
        completeConfig.infrastructure.sshUsername = securityResult.ssh.username;
      }
      
      Logger.info(chalk.gray(`🔄 SSH parameters updated for subsequent phases: port ${sshOptions.port}, username ${sshOptions.username}`));
    }
    
    // Store updated SSH options in deployment state for subsequent phases
    deploymentState.sshOptions = sshOptions;
    deploymentState.completeConfig = completeConfig;
    
    return securityResult;
  }

  /**
   * Execute DNS phase
   */
  async executeDNSPhase(projectPath, stepData, deploymentState) {
    const completeConfig = deploymentState.completeConfig;
    const sshOptions = deploymentState.sshOptions;
    
    return await this.dnsService.setupDNSRecords(completeConfig, sshOptions);
  }

  /**
   * Execute SSL phase
   */
  async executeSSLPhase(projectPath, stepData, deploymentState) {
    const completeConfig = deploymentState.completeConfig;
    const sshOptions = deploymentState.sshOptions;
    
    return await this.sslService.setupSSLCertificates(completeConfig, sshOptions);
  }

  /**
   * Execute application phase
   */
  async executeApplicationPhase(projectPath, stepData, deploymentState) {
    const completeConfig = deploymentState.completeConfig;
    const sshOptions = deploymentState.sshOptions;
    
    return await this.applicationService.deployApplication(completeConfig, sshOptions);
  }

  /**
   * Update configuration with infrastructure details immediately after creation
   */
  async updateConfigWithInfrastructure(projectPath, infrastructureResult) {
    const configPath = path.join(projectPath, '.focal-deploy', 'config.json');
    const config = await fs.readJson(configPath);
    
    // Debug logging to see what we received
    Logger.info(chalk.gray('Infrastructure result received:'));
    Logger.info(chalk.gray(JSON.stringify(infrastructureResult, null, 2)));
    
    // Extract public IP from either publicIpAddress or publicIp field
    const publicIp = infrastructureResult?.publicIpAddress || infrastructureResult?.publicIp;
    const instanceId = infrastructureResult?.instanceId;
    const keyPairName = infrastructureResult?.keyPairName;
    const privateKeyPath = infrastructureResult?.privateKeyPath;

    if (!instanceId || !publicIp) {
      throw new Error(`Missing EC2 instance information: instanceId=${instanceId}, publicIp=${publicIp}`);
    }

    // Add infrastructure details to the configuration
    config.infrastructure = {
      ...config.infrastructure,
      // CRITICAL FIX: Update keyPairName with the actual key created during infrastructure setup
      keyPairName: keyPairName || config.infrastructure?.keyPairName,
      ec2Instance: {
        instanceId: instanceId,
        publicIpAddress: publicIp,
        instanceType: config.infrastructure?.instanceType
      }
    };

    // CRITICAL FIX: Update AWS config with the actual private key path
    if (privateKeyPath) {
      config.aws = {
        ...config.aws,
        keyPath: privateKeyPath,
        keyPairName: keyPairName
      };
    }

    // Save updated configuration
    await fs.writeJson(configPath, config, { spaces: 2 });
    Logger.info(chalk.gray(`Configuration updated with EC2 details: ${instanceId} @ ${publicIp}`));
    if (keyPairName) {
      Logger.info(chalk.gray(`Key pair: ${keyPairName} at ${privateKeyPath}`));
    }
  }

  /**
   * Save wizard configuration in the format expected by deployment commands
   */
  async saveWizardConfiguration(projectPath, stepData) {
    const configDir = path.join(projectPath, '.focal-deploy');
    await fs.ensureDir(configDir);
    
    const config = {
      project: {
        name: stepData.project?.name || 'focal-deploy-project',
        description: stepData.project?.description || 'Project deployed with focal-deploy'
      },
      aws: {
        region: stepData.infrastructure?.region || 'us-east-1',
        accessKeyId: stepData.credentials?.aws?.accessKeyId,
        secretAccessKey: stepData.credentials?.aws?.secretAccessKey
      },
      infrastructure: {
        instanceType: stepData.infrastructure?.instanceType || stepData.infrastructure?.instance?.instanceType || 't3.micro',
        keyPairName: stepData.security?.ssh?.keyPairName || stepData.security?.firewall?.keyPairName || this.generateUniqueKeyPairName(stepData.project?.name),
        // Include SSH port in infrastructure config for security group setup
        sshPort: stepData.security?.ssh?.customPort || 2847,
        // Include operating system from wizard configuration - check both locations
        operatingSystem: stepData.infrastructure?.operatingSystem || stepData.infrastructure?.instance?.operatingSystem || 'ubuntu',
        securityGroup: {
          name: stepData.security?.firewall?.name || this.generateUniqueSecurityGroupName(stepData.project?.name),
          description: stepData.security?.firewall?.description || 'Security group for focal-deploy'
        }
      },
      storage: {
        s3: {
          bucketName: stepData.infrastructure?.storage?.s3?.bucketName,
          encryption: stepData.infrastructure?.storage?.s3?.encryption || true,
          publicAccess: stepData.infrastructure?.storage?.s3?.publicAccess || false
        },
        volumes: {
          root: stepData.infrastructure?.storage?.volumes?.root || 20,
          data: stepData.infrastructure?.storage?.volumes?.data || 10
        }
      },
      application: {
        type: stepData.project?.type || 'nodejs',
        port: stepData.project?.port || 3000,
        healthCheckPath: stepData.project?.healthCheckPath || '/health'
      },
      repository: stepData.repository || {},
      environment: stepData.environment || {},
      // Store complete security configuration for later use
      security: {
        ssh: {
          enabled: stepData.security?.ssh?.enabled !== false,
          customPort: stepData.security?.ssh?.customPort || 2847,
          authMethod: stepData.security?.ssh?.authMethod || 'keys-only',
          disableRootLogin: stepData.security?.ssh?.disableRootLogin !== false,
          deploymentUser: stepData.security?.ssh?.deploymentUser || 'deploy',
          maxAuthTries: stepData.security?.ssh?.maxAuthTries || 3,
          keyPairName: stepData.security?.ssh?.keyPairName || 'focal-deploy-keypair'
        },
        firewall: {
          enabled: stepData.security?.firewall?.enabled !== false,
          defaultIncoming: stepData.security?.firewall?.defaultIncoming || 'deny',
          allowedServices: stepData.security?.firewall?.allowedServices || ['HTTP', 'HTTPS', 'SSH'],
          sshPort: stepData.security?.ssh?.customPort || 2847,
          allowedPorts: stepData.security?.firewall?.allowedPorts || [80, 443, stepData.security?.ssh?.customPort || 2847],
          enableLogging: stepData.security?.firewall?.enableLogging !== false
        },
        intrusionPrevention: {
          enabled: stepData.security?.intrusionPrevention?.enabled !== false,
          maxRetries: stepData.security?.intrusionPrevention?.maxRetries || 5,
          banTime: stepData.security?.intrusionPrevention?.banTime || 3600,
          findTime: stepData.security?.intrusionPrevention?.findTime || 600,
          sshPort: stepData.security?.ssh?.customPort || 2847
        },
        systemUpdates: stepData.security?.systemUpdates || {
          enabled: true,
          frequency: 'daily',
          autoReboot: false,
          rebootTime: '02:00'
        },
        emergencyAccess: stepData.security?.emergencyAccess || {
          enableSSMAccess: true,
          createEmergencyUser: true,
          emergencyUsername: 'focal-emergency'
        }
      }
    };
    
    const configPath = path.join(configDir, 'config.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
    
    Logger.info(chalk.gray(`Configuration saved to ${configPath}`));
  }

  /**
   * Build complete configuration with infrastructure details
   */
  async buildCompleteConfig(projectPath, stepData, infrastructureResult) {
    // Load the saved configuration
    const configPath = path.join(projectPath, '.focal-deploy', 'config.json');
    const savedConfig = await fs.readJson(configPath);
    
    // Extract public IP from either publicIpAddress or publicIp field
    const publicIp = infrastructureResult?.publicIpAddress || infrastructureResult?.publicIp || 
                     stepData.infrastructure?.publicIp || savedConfig.infrastructure?.ec2Instance?.publicIpAddress;
    const instanceId = infrastructureResult?.instanceId || stepData.infrastructure?.instanceId || 
                       savedConfig.infrastructure?.ec2Instance?.instanceId;
    
    Logger.info(chalk.gray(`Building complete config with EC2: ${instanceId} @ ${publicIp}`));
    
    // Merge with infrastructure results and step data
    return {
      ...savedConfig,
      projectName: stepData.project?.name || savedConfig.project?.name,
      infrastructure: {
        ...savedConfig.infrastructure,
        ec2Instance: {
          publicIpAddress: publicIp,
          instanceId: instanceId,
          instanceType: savedConfig.infrastructure?.instanceType
        }
      },
      // Map security configuration from wizard to expected format
      securityConfig: {
        enabled: true,
        sshHardening: {
          enabled: stepData.security?.ssh?.enabled !== false,
          customPort: stepData.security?.ssh?.customPort || 2847,
          authMethod: stepData.security?.ssh?.authMethod || 'keys-only',
          disableRootLogin: stepData.security?.ssh?.disableRootLogin !== false,
          deploymentUser: stepData.security?.ssh?.deploymentUser || 'deploy',
          maxAuthTries: stepData.security?.ssh?.maxAuthTries || 3,
          permitEmptyPasswords: false,
          challengeResponseAuth: false,
          x11Forwarding: false
        },
        firewall: {
          enabled: stepData.security?.firewall?.enabled !== false,
          defaultIncoming: stepData.security?.firewall?.defaultIncoming || 'deny',
          allowedServices: stepData.security?.firewall?.allowedServices || ['HTTP', 'HTTPS', 'SSH'],
          sshPort: stepData.security?.ssh?.customPort || stepData.security?.firewall?.sshPort || 2847,
          allowedPorts: stepData.security?.firewall?.allowedPorts || [80, 443, stepData.security?.ssh?.customPort || 2847],
          enableLogging: stepData.security?.firewall?.enableLogging !== false
        },
        fail2ban: {
          enabled: stepData.security?.intrusionPrevention?.enabled !== false,
          maxRetries: stepData.security?.intrusionPrevention?.maxRetries || 5,
          banTime: stepData.security?.intrusionPrevention?.banTime || 3600,
          findTime: stepData.security?.intrusionPrevention?.findTime || 600,
          sshPort: stepData.security?.ssh?.customPort || stepData.security?.intrusionPrevention?.sshPort || 2847,
          services: ['ssh', 'apache', 'nginx']
        },
        autoUpdates: {
          enabled: stepData.security?.systemUpdates?.enabled !== false,
          frequency: stepData.security?.systemUpdates?.frequency || 'daily',
          autoReboot: stepData.security?.systemUpdates?.autoReboot || false,
          rebootTime: stepData.security?.systemUpdates?.rebootTime || '02:00'
        },
        monitoring: {
          enabled: stepData.security?.emergencyAccess?.enableSSMAccess !== false
        }
      },
      dnsConfig: stepData.dnsConfig?.enabled ? {
        enabled: true,
        provider: {
          // CRITICAL FIX: Transform wizard's string provider to object format expected by DNS service
          name: stepData.dnsConfig.provider?.name || stepData.dnsConfig.provider,  // Handle both formats
          apiToken: stepData.dnsConfig.credentials?.apiToken || stepData.dnsConfig.credentials?.token,
          credentials: stepData.dnsConfig.credentials
        },
        domains: stepData.dnsConfig.domains || [stepData.dnsConfig.primaryDomain],
        primaryDomain: stepData.dnsConfig.primaryDomain,
        subdomains: stepData.dnsConfig.subdomains || []
      } : { enabled: false },
      sslConfig: stepData.sslConfig || { enabled: false },
      applicationConfig: stepData.applicationConfig || { enabled: false },
      aws: {
        ...savedConfig.aws,
        // CRITICAL FIX: Include infrastructureResult keyPath in priority chain
        keyPath: infrastructureResult?.privateKeyPath ||
                 stepData.credentials?.aws?.keyPath ||
                 savedConfig.aws?.keyPath ||
                 (infrastructureResult?.keyPairName ? path.join(require('os').homedir(), '.ssh', infrastructureResult.keyPairName) : null)
      }
    };
  }

  /**
   * Generate deployment information for display
   */
  async generateDeploymentInfo(stepData, deploymentResults = {}) {
    const accessUrls = [];
    const publicIp = deploymentResults.infrastructure?.publicIp || stepData.infrastructure?.publicIp;
    
    // Add EC2 instance URL if available
    if (publicIp) {
      accessUrls.push(`http://${publicIp}`);
    }
    
    // Add domain URLs if configured and DNS was successful
    if (stepData.dnsConfig?.enabled && deploymentResults.dns?.success) {
      const domains = stepData.dnsConfig.domains || [];
      const hasSSL = stepData.sslConfig?.enabled && deploymentResults.ssl?.success;
      const protocol = hasSSL ? 'https' : 'http';
      
      domains.forEach(domain => {
        accessUrls.push(`${protocol}://${domain}`);
      });
    }

    // Generate SSH connection information
    const sshConnection = {
      username: stepData.security?.ssh?.deploymentUser || stepData.security?.ssh?.deploymentUsername || 'deploy',
      port: stepData.security?.ssh?.customPort || '2847',
      privateKeyPath: `~/.ssh/${stepData.security?.ssh?.keyPairName || 'focal-deploy-keypair'}.pem`
    };
    
    return {
      accessUrls,
      instanceType: stepData.infrastructure?.instanceType || stepData.infrastructure?.instance?.instanceType,
      region: stepData.infrastructure?.region,
      keyPairName: stepData.security?.ssh?.keyPairName || stepData.security?.firewall?.keyPairName,
      publicIp,
      sshConnection,
      deploymentPhases: {
        infrastructure: deploymentResults.infrastructure?.success || false,
        security: deploymentResults.security?.success || false,
        dns: deploymentResults.dns?.success || false,
        ssl: deploymentResults.ssl?.success || false,
        application: deploymentResults.application?.success || false
      },
      deployedAt: new Date().toISOString()
    };
  }

  /**
   * Display deployment summary
   */
  displayDeploymentSummary(deploymentInfo) {
    Logger.info(chalk.white(`\n📊 Deployment Summary:`));
    Logger.info(chalk.gray('─'.repeat(50)));
    
    // Instance information
    if (deploymentInfo.instanceType) {
      Logger.info(chalk.white(`Instance Type: ${deploymentInfo.instanceType}`));
    }
    if (deploymentInfo.region) {
      Logger.info(chalk.white(`Region: ${deploymentInfo.region}`));
    }
    if (deploymentInfo.publicIp) {
      Logger.info(chalk.white(`Public IP: ${deploymentInfo.publicIp}`));
    }
    
    // Phase status
    Logger.info(chalk.white(`\n🔍 Deployment Phases:`));
    const phases = deploymentInfo.deploymentPhases || {};
    Object.entries(phases).forEach(([phase, success]) => {
      const status = success ? chalk.green('✅') : chalk.red('❌');
      const phaseName = phase.charAt(0).toUpperCase() + phase.slice(1);
      Logger.info(`  ${status} ${phaseName}`);
    });
    
    // SSH Connection Instructions
    if (deploymentInfo.sshConnection) {
      Logger.info(chalk.white(`\n🔑 SSH Connection:`));
      Logger.info(chalk.cyan(`  ssh -i "${deploymentInfo.sshConnection.privateKeyPath}" -p ${deploymentInfo.sshConnection.port} ${deploymentInfo.sshConnection.username}@${deploymentInfo.publicIp}`));
      Logger.info(chalk.gray(`  Username: ${deploymentInfo.sshConnection.username} (deployment user)`));
      Logger.info(chalk.gray(`  Port: ${deploymentInfo.sshConnection.port}`));
      Logger.info(chalk.gray(`  Key: ${deploymentInfo.sshConnection.privateKeyPath}`));
    }
    
    // Access URLs
    if (deploymentInfo.accessUrls && deploymentInfo.accessUrls.length > 0) {
      Logger.info(chalk.white(`\n🌐 Access URLs:`));
      deploymentInfo.accessUrls.forEach(url => {
        Logger.info(chalk.cyan(`  🔗 ${url}`));
      });
    }
    
    Logger.info(chalk.gray('─'.repeat(50)));
    Logger.info(chalk.white(`Deployed at: ${deploymentInfo.deployedAt}`));
  }
}

module.exports = DeploymentExecutor;