const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');
const { GitHubRepoTracker } = require('../utils/github-repo-tracker');
const { WizardManager } = require('../wizard/wizard-manager');

class NewCommand {
  constructor() {
    this.logger = Logger;
    this.repoTracker = new GitHubRepoTracker();
  }

  async execute(projectName, options) {
    try {
      // Handle resume mode without project name
      if (options.resume && !projectName) {
        return await this.handleResumeFromCurrentDirectory(options);
      }

      // Validate project name
      this.validateProjectName(projectName);

      // Resolve target directory
      const targetPath = this.resolveTargetPath(projectName, options);

      // Check for existing directory and handle conflicts
      await this.handleDirectoryConflicts(targetPath, options);

      // Initialize and run the wizard
      const wizard = new WizardManager(projectName, targetPath, options);
      
      // Check if we should resume from a previous session
      if (options.resume) {
        // Look for existing wizard sessions
        const sessionPath = path.join(targetPath, '.focal-deploy', 'wizard');
        if (await fs.pathExists(sessionPath)) {
          const sessionFiles = await fs.readdir(sessionPath);
          const jsonFiles = sessionFiles.filter(f => f.endsWith('.json'));
          
          if (jsonFiles.length > 0) {
            // Use the most recent session
            const sessionFile = jsonFiles[jsonFiles.length - 1];
            const sessionId = path.basename(sessionFile, '.json');
            
            this.logger.info(`🔄 Resuming from previous session: ${sessionId}`);
            await wizard.resumeWizard(sessionId);
          } else {
            this.logger.warn('No previous session found, starting fresh wizard');
            await wizard.start();
          }
        } else {
          this.logger.warn('No previous session found, starting fresh wizard');
          await wizard.start();
        }
      } else {
        await wizard.start();
      }

      // Display final success message
      this.displayFinalMessage(projectName, targetPath, options);

    } catch (error) {
      this.logger.error(`Failed to create project: ${error.message}`);
      throw error;
    }
  }

  async handleResumeFromCurrentDirectory(options) {
    const currentDir = process.cwd();
    
    // Check if we're in a focal-deploy project directory
    const wizardDir = path.join(currentDir, '.focal-deploy', 'wizard');
    
    if (!await fs.pathExists(wizardDir)) {
      this.logger.error('❌ No focal-deploy project found in current directory');
      this.logger.info('💡 Make sure you are in a directory that contains a .focal-deploy folder');
      this.logger.info('💡 Or use "focal-deploy new <project-name>" to create a new project');
      process.exit(1);
    }

    // Find existing wizard session files
    const sessionFiles = await fs.readdir(wizardDir);
    const jsonFiles = sessionFiles.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      this.logger.error('❌ No wizard sessions found to resume');
      this.logger.info('💡 Use "focal-deploy new <project-name>" to start a new setup');
      process.exit(1);
    }

    // Use the most recent session file
    const sessionFile = jsonFiles[jsonFiles.length - 1];
    const sessionId = path.basename(sessionFile, '.json');
    
    this.logger.info(`🔄 Found wizard session: ${chalk.cyan(sessionId.substring(0, 8))}...`);
    
    // Load the wizard state to get project info
    const sessionPath = path.join(wizardDir, sessionFile);
    const wizardState = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    
    this.logger.info(`📋 Resuming project: ${chalk.cyan(wizardState.projectName)}`);
    this.logger.info(`📁 Location: ${chalk.gray(wizardState.projectPath)}`);
    
    // Initialize wizard manager and resume
    const wizard = new WizardManager(wizardState.projectName, wizardState.projectPath, options);
    await wizard.resumeWizard(sessionId);
    
    this.logger.success('✅ Wizard session resumed successfully!');
  }

  validateProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Project name is required');
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
      throw new Error('Project name can only contain letters, numbers, hyphens, and underscores');
    }

    if (projectName.length > 50) {
      throw new Error('Project name must be 50 characters or less');
    }
  }

  resolveTargetPath(projectName, options) {
    if (options.path) {
      return path.resolve(options.path, projectName);
    }

    if (options.here) {
      return path.resolve(process.cwd());
    }

    return path.resolve(process.cwd(), projectName);
  }

  async handleDirectoryConflicts(targetPath, options) {
    const exists = await fs.pathExists(targetPath);
    
    if (exists) {
      const isEmpty = (await fs.readdir(targetPath)).length === 0;
      
      if (!isEmpty && !options.force) {
        if (options.quiet) {
          throw new Error(`Directory ${targetPath} already exists and is not empty`);
        }

        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Directory ${targetPath} already exists and is not empty. Continue anyway?`,
            default: false
          }
        ]);

        if (!proceed) {
          throw new Error('Project creation cancelled');
        }
      }
    }

    // Ensure we have write permissions
    try {
      await fs.ensureDir(targetPath);
      await fs.access(targetPath, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Cannot write to directory ${targetPath}: ${error.message}`);
    }
  }

  async prepareGitOptions(projectName, options) {
    const gitOptions = {
      projectName,
      githubRepo: options.githubRepo || projectName,
      isPrivate: !options.public,
      githubToken: options.githubToken,
      gitUser: options.gitUser,
      gitEmail: options.gitEmail,
      skipGit: options.noGit,
      skipGithub: options.noGithub
    };

    // If Git integration is enabled but no GitHub token provided, prompt for it
    if (!options.noGit && !options.noGithub && !gitOptions.githubToken && !options.quiet) {
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: '🔑 GitHub Personal Access Token (optional, press Enter to skip):',
          mask: '*'
        }
      ]);

      if (token) {
        gitOptions.githubToken = token;
      } else {
        gitOptions.skipGithub = true;
      }
    }

    // Set GitHub URL if we have a token
    if (gitOptions.githubToken && !gitOptions.skipGithub) {
      // Initialize GitHub API and get user info
      const githubAPI = new GitHubAPI(gitOptions.githubToken);
      const tokenValidation = await githubAPI.validateToken();
      
      if (tokenValidation.valid) {
        gitOptions.githubUrl = `https://github.com/${tokenValidation.user.login}/${gitOptions.githubRepo}`;
        gitOptions.githubUser = tokenValidation.user.login;
      } else {
        this.logger.warning('GitHub token validation failed, skipping GitHub integration');
        gitOptions.skipGithub = true;
      }
    }

    return gitOptions;
  }

  displayFinalMessage(projectName, targetPath, options) {
    if (options.quiet) return;

    this.logger.success(`\n🎉 Project "${projectName}" setup completed successfully!`);
    this.logger.info(`📁 Location: ${chalk.gray(targetPath)}`);
    this.logger.success(`✅ All configurations applied`);
    this.logger.success(`✅ Emergency access mechanisms configured`);
    this.logger.success(`✅ Ready for deployment`);

    // Display next steps
    this.logger.info('\n💡 Your application is ready to use:');
    this.logger.info(`   cd ${projectName}`);
    this.logger.info(`   focal-deploy status  # Check deployment status`);
    this.logger.info(`   focal-deploy up      # Start/restart your application`);
    
    this.logger.info('\n🔄 Development workflow:');
    this.logger.info('   1. Edit your code');
    this.logger.info('   2. git add . && git commit -m "Your changes"');
    this.logger.info('   3. git push');
    this.logger.info('   4. focal-deploy deploy (to update EC2)');
    
    this.logger.info('\n🚨 Emergency access:');
    this.logger.info('   focal-deploy emergency-access  # Generate emergency access commands');
    this.logger.info('   focal-deploy recovery          # Run emergency recovery procedures');
  }
}

module.exports = { NewCommand };