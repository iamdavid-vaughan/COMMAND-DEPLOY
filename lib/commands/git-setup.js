const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { Logger } = require('../utils/logger');
const { GitHubAPI } = require('../utils/github-api');
const { GitHubRepoTracker } = require('../utils/github-repo-tracker');
const { SSHKeyManager } = require('../utils/ssh-key-manager');
const { ConfigLoader } = require('../config/loader');

class GitSetupCommand {
  constructor() {
    this.logger = Logger;
    this.sshKeyManager = new SSHKeyManager();
    this.gitIntegration = new GitIntegration();
    this.repoTracker = new GitHubRepoTracker();
  }

  async execute(options) {
    try {
      this.logger.info(`🔧 ${chalk.bold('focal-deploy git-setup')}`);
      this.logger.info('Setting up Git integration for existing project...\n');

      // Validate current directory is a project
      const projectValidation = await this.validateProject();
      if (!projectValidation.valid) {
        this.logger.error(projectValidation.error);
        return false;
      }

      // Get GitHub token
      const githubToken = await this.getGitHubToken(options.githubToken);
      if (!githubToken) {
        this.logger.error('GitHub token is required for Git setup');
        return false;
      }

      // Initialize GitHub API
      const githubAPI = new GitHubAPI(githubToken);
      const tokenValidation = await githubAPI.validateToken();
      if (!tokenValidation.valid) {
        this.logger.error(`Invalid GitHub token: ${tokenValidation.error}`);
        return false;
      }

      // Get repository information
      const repoInfo = await this.getRepositoryInfo(options, tokenValidation.user);
      if (!repoInfo) {
        return false;
      }

      // Setup or validate repository
      const repoSetup = await this.setupRepository(githubAPI, repoInfo);
      if (!repoSetup.success) {
        this.logger.error(`Repository setup failed: ${repoSetup.error}`);
        return false;
      }

      // Generate SSH keys for deployment
      const keySetup = await this.setupDeployKeys(repoInfo.projectName, repoSetup.repository);
      if (!keySetup.success) {
        this.logger.error(`Deploy key setup failed: ${keySetup.error}`);
        return false;
      }

      // Add deploy key to GitHub
      const deployKeySetup = await this.addDeployKeyToGitHub(
        githubAPI,
        repoSetup.repository,
        keySetup.publicKey,
        repoInfo.projectName
      );
      if (!deployKeySetup.success) {
        this.logger.error(`Failed to add deploy key: ${deployKeySetup.error}`);
        return false;
      }

      // Setup local Git repository
      const gitSetup = await this.setupLocalGit(repoSetup.repository, repoInfo);
      if (!gitSetup.success) {
        this.logger.error(`Local Git setup failed: ${gitSetup.error}`);
        return false;
      }

      // Update deployment configuration
      await this.updateDeploymentConfig(repoInfo.projectName, repoSetup.repository, keySetup.privateKeyPath);

      // Display success information
      this.displaySuccessInfo(repoSetup.repository, keySetup);

      return true;

    } catch (error) {
      this.logger.error(`Git setup failed: ${error.message}`);
      return false;
    }
  }

  async validateProject() {
    try {
      const cwd = process.cwd();
      
      // Check for package.json
      const packageJsonPath = path.join(cwd, 'package.json');
      if (!await fs.pathExists(packageJsonPath)) {
        return { valid: false, error: 'No package.json found. Run this command in a Node.js project directory.' };
      }

      // Check for focal-deploy config
      const files = await fs.readdir(cwd);
      const deployConfig = files.find(file => file.endsWith('-deploy.yml'));
      
      if (!deployConfig) {
        return { valid: false, error: 'No focal-deploy configuration found. This doesn\'t appear to be a focal-deploy project.' };
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const projectName = packageJson.name || path.basename(cwd);

      return {
        valid: true,
        projectName,
        deployConfig,
        packageJson
      };

    } catch (error) {
      return { valid: false, error: `Project validation failed: ${error.message}` };
    }
  }

  async getGitHubToken(providedToken) {
    if (providedToken) {
      return providedToken;
    }

    // Check environment variable
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) {
      this.logger.info('Using GitHub token from environment variable');
      return envToken;
    }

    // Prompt user for token
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your GitHub personal access token:',
        validate: (input) => {
          if (!input || input.length < 10) {
            return 'Please enter a valid GitHub token';
          }
          return true;
        }
      }
    ]);

    return token;
  }

  async getRepositoryInfo(options, githubUser) {
    const cwd = process.cwd();
    const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
    const projectName = packageJson.name || path.basename(cwd);

    let repoName, repoOwner;

    if (options.githubRepo) {
      // Parse provided repository
      const repoParts = options.githubRepo.split('/');
      if (repoParts.length === 2) {
        repoOwner = repoParts[0];
        repoName = repoParts[1];
      } else {
        repoOwner = githubUser.login;
        repoName = options.githubRepo;
      }
    } else {
      // Use project name as repository name
      repoOwner = githubUser.login;
      repoName = projectName;
    }

    return {
      projectName,
      repoName,
      repoOwner,
      fullName: `${repoOwner}/${repoName}`
    };
  }

  async setupRepository(githubAPI, repoInfo) {
    try {
      // Check if repository exists
      const existingRepo = await githubAPI.getRepository(repoInfo.repoOwner, repoInfo.repoName);
      
      if (existingRepo.success) {
        this.logger.info(`📁 Using existing repository: ${chalk.cyan(existingRepo.repository.htmlUrl)}`);
        return { success: true, repository: existingRepo.repository };
      }

      // Create new repository
      this.logger.info(`🏗️  Creating new repository: ${chalk.cyan(repoInfo.fullName)}`);
      
      const { createRepo } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createRepo',
          message: `Repository ${repoInfo.fullName} doesn't exist. Create it?`,
          default: true
        }
      ]);

      if (!createRepo) {
        return { success: false, error: 'Repository creation cancelled' };
      }

      const { isPrivate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'isPrivate',
          message: 'Make repository private?',
          default: false
        }
      ]);

      const newRepo = await githubAPI.createRepository(repoInfo.repoName, {
        description: `${repoInfo.projectName} - Node.js application with focal-deploy`,
        private: isPrivate
      });

      if (!newRepo.success) {
        return { success: false, error: newRepo.error };
      }

      this.logger.success(`✅ Repository created: ${chalk.cyan(newRepo.repository.htmlUrl)}`);
      
      // Track the newly created repository
      await this.repoTracker.trackRepository(newRepo.repository.name, {
        url: newRepo.repository.htmlUrl,
        sshUrl: newRepo.repository.sshUrl,
        owner: newRepo.repository.owner,
        private: newRepo.repository.private,
        createdAt: new Date().toISOString(),
        projectPath: process.cwd(),
        tags: ['focal-deploy', 'git-setup']
      });
      
      return { success: true, repository: newRepo.repository };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setupDeployKeys(projectName, repository) {
    try {
      const keyName = `${projectName}_deploy_key`;
      
      // Generate SSH key pair
      const keyResult = await this.sshKeyManager.generateKeyPair(
        keyName,
        'ed25519',
        `focal-deploy-${projectName}-${Date.now()}`
      );

      if (!keyResult.success) {
        return { success: false, error: keyResult.error };
      }

      // Read public key
      const publicKeyResult = await this.sshKeyManager.readPublicKey(keyName);
      if (!publicKeyResult.success) {
        return { success: false, error: publicKeyResult.error };
      }

      return {
        success: true,
        keyName,
        privateKeyPath: keyResult.privateKeyPath,
        publicKeyPath: keyResult.publicKeyPath,
        publicKey: publicKeyResult.publicKey
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addDeployKeyToGitHub(githubAPI, repository, publicKey, projectName) {
    try {
      const keyTitle = `focal-deploy-${projectName}-${Date.now()}`;
      
      const result = await githubAPI.addDeployKey(
        repository.owner,
        repository.name,
        keyTitle,
        publicKey,
        false // read_only = false for push access
      );

      return result;

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setupLocalGit(repository, repoInfo) {
    try {
      const cwd = process.cwd();
      
      // Check if already a Git repository
      const isGitRepo = await this.gitIntegration.isGitRepository(cwd);
      
      if (!isGitRepo) {
        // Initialize Git repository
        await this.gitIntegration.initializeLocalGit(cwd, {
          projectName: repoInfo.projectName,
          githubUrl: repository.sshUrl,
          timestamp: Date.now()
        });
      } else {
        this.logger.info('📁 Git repository already initialized');
      }

      // Add remote if not exists
      const git = require('simple-git')(cwd);
      const remotes = await git.getRemotes(true);
      const originExists = remotes.find(remote => remote.name === 'origin');

      if (!originExists) {
        await git.addRemote('origin', repository.sshUrl);
        this.logger.success('✅ Remote origin added');
      } else {
        this.logger.info('📁 Remote origin already configured');
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateDeploymentConfig(projectName, repository, privateKeyPath) {
    try {
      const cwd = process.cwd();
      const configPath = path.join(cwd, `${projectName}-deploy.yml`);
      
      if (!await fs.pathExists(configPath)) {
        this.logger.warning('Deployment config not found, skipping update');
        return;
      }

      let configContent = await fs.readFile(configPath, 'utf8');
      
      // Add Git configuration section if not exists
      if (!configContent.includes('git:')) {
        const gitConfig = `
git:
  repository: ${repository.sshUrl}
  branch: main
  deploy_key: ${privateKeyPath}
`;
        configContent += gitConfig;
        
        await fs.writeFile(configPath, configContent);
        this.logger.success('✅ Deployment configuration updated with Git settings');
      } else {
        this.logger.info('📁 Git configuration already exists in deployment config');
      }

    } catch (error) {
      this.logger.warning(`Failed to update deployment config: ${error.message}`);
    }
  }

  displaySuccessInfo(repository, keySetup) {
    this.logger.success('\n🎉 Git setup completed successfully!\n');
    
    console.log(chalk.bold('📋 Setup Summary:'));
    console.log(`   Repository: ${chalk.cyan(repository.htmlUrl)}`);
    console.log(`   SSH Key: ${chalk.cyan(keySetup.keyName)}`);
    console.log(`   Private Key: ${chalk.gray(keySetup.privateKeyPath)}`);
    console.log(`   Public Key: ${chalk.gray(keySetup.publicKeyPath)}\n`);

    console.log(chalk.bold('🚀 Next Steps:'));
    console.log('   1. Commit and push your code:');
    console.log(`      ${chalk.cyan('git add .')}`);
    console.log(`      ${chalk.cyan('git commit -m "Setup focal-deploy Git integration"')}`);
    console.log(`      ${chalk.cyan('git push -u origin main')}\n`);
    
    console.log('   2. Deploy to AWS:');
    console.log(`      ${chalk.cyan('focal-deploy up')}\n`);
    
    console.log('   3. For future deployments:');
    console.log(`      ${chalk.cyan('focal-deploy push-deploy')}\n`);

    console.log(chalk.bold('💡 Tips:'));
    console.log('   • Use `focal-deploy push-deploy` to commit, push, and deploy in one command');
    console.log('   • Your EC2 instance will automatically pull from the Git repository');
    console.log('   • Deploy keys are configured for secure access to your repository\n');
  }
}

module.exports = { GitSetupCommand };