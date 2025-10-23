const { ConfigLoader } = require('../config/loader');
const { validateAWSCredentials } = require('../aws/validator');
const { ECRService } = require('../aws/ecr');
const { DockerService } = require('../utils/docker');
const { StateManager } = require('../utils/state');
const { CostEstimator } = require('../utils/cost');
const { logger } = require('../utils/logger');
const { FocalDeployError } = require('../utils/errors');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');

// Helper function to load configuration (wizard or legacy)
async function loadConfiguration() {
  try {
    // Check for wizard-generated configuration first
    const wizardConfigPath = path.join(process.cwd(), '.focal-deploy', 'config.json');
    if (await fs.pathExists(wizardConfigPath)) {
      return await loadWizardConfiguration(wizardConfigPath);
    }

    // Fall back to legacy configuration
    const configLoader = new ConfigLoader();
    if (!configLoader.exists()) {
      throw new FocalDeployError(
        'No configuration file found. Please run "focal-deploy new <project-name>" to create a new project with wizard setup.',
        'Run "focal-deploy new <project-name>" to create a new project with complete setup wizard.'
      );
    }
    
    return await configLoader.load();
  } catch (error) {
    throw error;
  }
}

async function loadWizardConfiguration(configPath) {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const wizardConfig = JSON.parse(configContent);

    // Transform wizard config to deployment config format
    const deployConfig = {
      project: {
        name: wizardConfig.projectName,
        type: wizardConfig.application?.type || 'nodejs-web',
        port: wizardConfig.application?.port || 3000,
        healthCheck: wizardConfig.application?.healthCheckPath || '/health'
      },
      aws: {
        region: wizardConfig.infrastructure?.region || 'us-east-1',
        accessKeyId: wizardConfig.credentials?.aws?.accessKeyId,
        secretAccessKey: wizardConfig.credentials?.aws?.secretAccessKey,
        instanceType: wizardConfig.infrastructure?.instanceType || 't3.micro',
        keyPairName: wizardConfig.infrastructure?.keyPairName,
        // Include operating system from wizard configuration
        operatingSystem: wizardConfig.infrastructure?.operatingSystem || 'ubuntu'
      },
      application: {
        useDocker: wizardConfig.application?.useDocker || true,
        nodeVersion: wizardConfig.application?.nodeVersion || '20',
        packageManager: wizardConfig.application?.packageManager || 'npm'
      },
      domains: wizardConfig.domains || { enabled: false },
      git: wizardConfig.repository || { enabled: false },
      security: wizardConfig.security || {},
      environment: wizardConfig.environment || {}
    };

    // Load AWS credentials from secure storage if not in config
    const CredentialManager = require('../utils/credentials');
    const credentialManager = new CredentialManager(deployConfig.project.name);
    if (!deployConfig.aws.accessKeyId || !deployConfig.aws.secretAccessKey) {
      const storedCredentials = await credentialManager.loadCredentials();
      if (storedCredentials) {
        deployConfig.aws = { ...deployConfig.aws, ...storedCredentials };
      }
    }

    return deployConfig;
  } catch (error) {
    throw new FocalDeployError(
      `Failed to load wizard configuration: ${error.message}`,
      'Check if the .focal-deploy/config.json file is valid JSON format.'
    );
  }
}

async function deployCommand(options = {}) {
  const dryRun = options.dryRun || false;
  let spinner;

  try {
    // Load configuration
    spinner = ora('Loading configuration...').start();
    const config = await loadConfiguration();
    
    if (!config) {
      spinner.fail('Configuration not found. Please run "focal-deploy new <project-name>" to create a new project with wizard setup.');
      process.exit(1);
    }
    
    spinner.succeed('Configuration loaded');

    // Initialize services
    const stateManager = new StateManager();
    const costEstimator = new CostEstimator();

    // Show cost warning for ECR deployment
    if (!dryRun) {
      const phase2Services = ['ecr'];
      const costs = costEstimator.displayPhase2CostWarning(phase2Services);
      
      if (costs.total > 0) {
        const confirmed = await costEstimator.promptCostConfirmation(costs);
        if (!confirmed) {
          logger.info(chalk.yellow('Deployment cancelled by user.'));
          process.exit(0);
        }
      }
    }

    // Validate AWS credentials
    if (!dryRun) {
      spinner = ora('Validating AWS credentials...').start();
      const isValid = await validateAWSCredentials(config.aws);
      
      if (!isValid) {
        spinner.fail('AWS credentials validation failed');
        process.exit(1);
      }
      
      spinner.succeed('AWS credentials validated');
    } else {
      logger.info(chalk.cyan('[DRY RUN] Skipping AWS credentials validation'));
    }

    // Initialize services
    const ecrService = new ECRService(config.aws, config.aws.region);
    const dockerService = new DockerService();

    // Check for Dockerfile
    spinner = ora('Checking for Dockerfile...').start();
    const projectPath = process.cwd();
    const dockerfilePath = await dockerService.detectDockerfile(projectPath);
    
    if (!dockerfilePath) {
      spinner.warn('No Dockerfile found. Skipping container deployment.');
      logger.info(chalk.yellow('💡 To use Docker deployment, add a Dockerfile to your project root.'));
      return;
    }
    
    spinner.succeed('Dockerfile found');

    // Generate image names
    const imageName = dockerService.generateImageName(config.project.name, config.aws.region);
    const repositoryName = imageName;

    // Show deployment plan
    if (dryRun) {
      logger.info(chalk.cyan('\n🔍 DEPLOYMENT PLAN (DRY RUN)'));
      logger.info(chalk.cyan('================================'));
      logger.info(chalk.cyan(`Project: ${config.project.name}`));
      logger.info(chalk.cyan(`Docker Image: ${imageName}:latest`));
      logger.info(chalk.cyan(`ECR Repository: ${repositoryName}`));
      logger.info(chalk.cyan(`AWS Region: ${config.aws.region}`));
      logger.info(chalk.cyan('================================\n'));
    }

    // Create ECR repository
    spinner = ora('Creating ECR repository...').start();
    const repositoryResult = await ecrService.createRepository(repositoryName, dryRun);
    const repositoryUri = repositoryResult.repository.repositoryUri;
    spinner.succeed(`ECR repository ready: ${repositoryName}`);

    // Get ECR authorization token
    spinner = ora('Getting ECR authorization...').start();
    const authResult = await ecrService.getAuthorizationToken(dryRun);
    const authToken = authResult.authorizationData[0].authorizationToken;
    const registryUrl = authResult.authorizationData[0].proxyEndpoint;
    spinner.succeed('ECR authorization obtained');

    // Login to ECR
    spinner = ora('Logging in to ECR...').start();
    await dockerService.loginToECR(authToken, registryUrl, dryRun);
    spinner.succeed('Logged in to ECR');

    // Build Docker image
    spinner = ora('Building Docker image...').start();
    const buildResult = await dockerService.buildImage(
      dockerfilePath,
      imageName,
      'latest',
      dryRun
    );
    spinner.succeed(`Docker image built: ${buildResult.imageName}`);

    // Tag image for ECR
    const ecrImageName = `${repositoryUri}:latest`;
    spinner = ora('Tagging image for ECR...').start();
    await dockerService.tagImage(buildResult.imageName, ecrImageName, dryRun);
    spinner.succeed(`Image tagged for ECR: ${ecrImageName}`);

    // Push image to ECR
    spinner = ora('Pushing image to ECR...').start();
    await dockerService.pushImage(ecrImageName, dryRun);
    spinner.succeed('Image pushed to ECR');

    // Update state file with deployment info
    if (!dryRun) {
      await stateManager.updateState('deployment', {
        ecrRepository: repositoryName,
        ecrRepositoryUri: repositoryUri,
        dockerImage: ecrImageName,
        lastDeployment: new Date().toISOString()
      });

      // Track ECR repository as a resource
      await stateManager.addResource('ecrRepository', {
        repositoryName,
        repositoryUri,
        region: config.aws.region
      });
    }

    // Success summary
    logger.info(chalk.green('\n🎉 DEPLOYMENT SUCCESSFUL!'));
    logger.info(chalk.green('========================'));
    logger.info(chalk.white(`Project: ${config.project.name}`));
    logger.info(chalk.white(`Docker Image: ${ecrImageName}`));
    logger.info(chalk.white(`ECR Repository: ${repositoryUri}`));
    
    if (dryRun) {
      logger.info(chalk.cyan('\n💡 This was a dry run. No actual resources were created.'));
      logger.info(chalk.cyan('Run without --dry-run to perform actual deployment.'));
    } else {
      logger.info(chalk.green('\n✅ Your application container is now available in ECR!'));
      logger.info(chalk.white('Next steps:'));
      logger.info(chalk.white('1. Run "focal-deploy up" to deploy to EC2'));
      logger.info(chalk.white('2. Run "focal-deploy status" to check deployment status'));
    }

  } catch (error) {
    if (spinner) {
      spinner.fail(`Deployment failed: ${error.message}`);
    }
    
    logger.error(chalk.red(`\n❌ Deployment Error: ${error.message}`));
    
    if (error.code === 'ENOENT' && error.path === 'docker') {
      logger.error(chalk.red('💡 Docker is not installed or not in PATH. Please install Docker to use container features.'));
    }
    
    process.exit(1);
  }
}

module.exports = { deployCommand };