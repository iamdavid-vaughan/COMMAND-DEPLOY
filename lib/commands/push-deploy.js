const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { Logger } = require('../utils/logger');
const { GitIntegration } = require('../utils/git-integration');

class PushDeployCommand {
  constructor() {
    this.logger = Logger;
    this.gitIntegration = new GitIntegration();
  }

  async execute(options) {
    try {
      this.logger.info(`🚀 ${chalk.bold('focal-deploy push-deploy')}`);
      this.logger.info('Commit, push, and deploy in one command...\n');

      // Validate current directory is a Git repository
      const gitValidation = await this.validateGitRepository();
      if (!gitValidation.valid) {
        this.logger.error(gitValidation.error);
        return false;
      }

      // Check Git status
      const status = await this.gitIntegration.checkGitStatus(process.cwd());
      if (!status) {
        this.logger.error('Failed to check Git status');
        return false;
      }

      // Handle dry run
      if (options.dryRun) {
        return await this.performDryRun(status, options);
      }

      // Check if there are changes to commit
      if (status.files.length === 0) {
        this.logger.info('📁 No changes to commit');
        
        const { proceedWithDeploy } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceedWithDeploy',
            message: 'No changes found. Deploy anyway?',
            default: false
          }
        ]);

        if (!proceedWithDeploy) {
          this.logger.info('Deployment cancelled');
          return true;
        }
      } else {
        // Show changes and get commit message
        this.displayChanges(status);
        
        const commitMessage = await this.getCommitMessage(options.message);
        if (!commitMessage) {
          this.logger.info('Deployment cancelled');
          return true;
        }

        // Commit and push changes
        const pushResult = await this.commitAndPush(commitMessage);
        if (!pushResult) {
          return false;
        }
      }

      // Deploy to EC2
      const deployResult = await this.deployToEC2();
      if (!deployResult) {
        return false;
      }

      this.displaySuccessInfo();
      return true;

    } catch (error) {
      this.logger.error(`Push-deploy failed: ${error.message}`);
      return false;
    }
  }

  async validateGitRepository() {
    try {
      const cwd = process.cwd();
      
      // Check if it's a Git repository
      const isGitRepo = await this.gitIntegration.isGitRepository(cwd);
      if (!isGitRepo) {
        return { 
          valid: false, 
          error: 'Not a Git repository. Run `focal-deploy git-setup` first or `git init` to initialize.' 
        };
      }

      // Check if remote origin exists
      const repoUrl = await this.gitIntegration.getRepositoryUrl(cwd);
      if (!repoUrl) {
        return { 
          valid: false, 
          error: 'No remote origin configured. Run `focal-deploy git-setup` to configure Git integration.' 
        };
      }

      // Check for focal-deploy config
      const files = await fs.readdir(cwd);
      const deployConfig = files.find(file => file.endsWith('-deploy.yml'));
      
      if (!deployConfig) {
        return { 
          valid: false, 
          error: 'No focal-deploy configuration found. This doesn\'t appear to be a focal-deploy project.' 
        };
      }

      return { valid: true, repoUrl, deployConfig };

    } catch (error) {
      return { valid: false, error: `Repository validation failed: ${error.message}` };
    }
  }

  async performDryRun(status, options) {
    this.logger.info(`🔍 ${chalk.bold('Dry Run Mode')} - No changes will be made\n`);

    // Show what would be committed
    if (status.files.length > 0) {
      this.displayChanges(status);
      
      const commitMessage = options.message || 'Update application';
      console.log(chalk.bold('📝 Would commit with message:'));
      console.log(`   "${chalk.cyan(commitMessage)}"\n`);
      
      console.log(chalk.bold('🔄 Would perform:'));
      console.log('   1. git add .');
      console.log('   2. git commit -m "' + commitMessage + '"');
      console.log('   3. git push origin main');
    } else {
      console.log(chalk.yellow('📁 No changes to commit\n'));
    }

    console.log('   4. focal-deploy deploy (update EC2 instance)\n');

    console.log(chalk.bold('💡 To execute these changes, run:'));
    console.log(`   ${chalk.cyan('focal-deploy push-deploy')}\n`);

    return true;
  }

  displayChanges(status) {
    console.log(chalk.bold('📋 Changes to be committed:\n'));

    if (status.created.length > 0) {
      console.log(chalk.green('   New files:'));
      status.created.forEach(file => {
        console.log(`     ${chalk.green('+')} ${file}`);
      });
      console.log();
    }

    if (status.modified.length > 0) {
      console.log(chalk.yellow('   Modified files:'));
      status.modified.forEach(file => {
        console.log(`     ${chalk.yellow('M')} ${file}`);
      });
      console.log();
    }

    if (status.deleted.length > 0) {
      console.log(chalk.red('   Deleted files:'));
      status.deleted.forEach(file => {
        console.log(`     ${chalk.red('-')} ${file}`);
      });
      console.log();
    }

    if (status.renamed.length > 0) {
      console.log(chalk.blue('   Renamed files:'));
      status.renamed.forEach(file => {
        console.log(`     ${chalk.blue('R')} ${file.from} → ${file.to}`);
      });
      console.log();
    }
  }

  async getCommitMessage(providedMessage) {
    if (providedMessage) {
      return providedMessage;
    }

    const { commitMessage } = await inquirer.prompt([
      {
        type: 'input',
        name: 'commitMessage',
        message: 'Enter commit message:',
        default: 'Update application',
        validate: (input) => {
          if (!input.trim()) {
            return 'Commit message cannot be empty';
          }
          return true;
        }
      }
    ]);

    return commitMessage.trim();
  }

  async commitAndPush(commitMessage) {
    try {
      this.logger.info('📝 Committing changes...');
      
      const result = await this.gitIntegration.commitAndPush(
        process.cwd(),
        commitMessage,
        'main'
      );

      if (result) {
        this.logger.success('✅ Changes committed and pushed to repository');
        return true;
      } else {
        this.logger.error('Failed to commit and push changes');
        return false;
      }

    } catch (error) {
      this.logger.error(`Commit and push failed: ${error.message}`);
      return false;
    }
  }

  async deployToEC2() {
    try {
      this.logger.info('🚀 Deploying to EC2 instance...');

      // Import the deploy command
      const { DeployCommand } = require('./deploy');
      const deployCommand = new DeployCommand();

      // Execute deployment
      const deployResult = await deployCommand.execute({
        skipConfirmation: true,
        gitPull: true
      });

      if (deployResult) {
        this.logger.success('✅ Deployment to EC2 completed');
        return true;
      } else {
        this.logger.error('❌ Deployment to EC2 failed');
        return false;
      }

    } catch (error) {
      this.logger.error(`EC2 deployment failed: ${error.message}`);
      
      // If deploy command doesn't exist, show manual instructions
      if (error.message.includes('Cannot find module')) {
        this.logger.info('\n💡 Manual deployment required:');
        this.logger.info(`   Run: ${chalk.cyan('focal-deploy deploy')}`);
        return true;
      }
      
      return false;
    }
  }

  displaySuccessInfo() {
    this.logger.success('\n🎉 Push-deploy completed successfully!\n');
    
    console.log(chalk.bold('✅ Completed Steps:'));
    console.log('   1. ✅ Changes committed to Git');
    console.log('   2. ✅ Code pushed to repository');
    console.log('   3. ✅ Application deployed to EC2\n');

    console.log(chalk.bold('🌐 Your application is now live!'));
    console.log('   • Check status: ' + chalk.cyan('focal-deploy status'));
    console.log('   • View logs: ' + chalk.cyan('focal-deploy monitor-logs'));
    console.log('   • Update domain: ' + chalk.cyan('focal-deploy domain-configure'));

    console.log(chalk.bold('💡 Next time:'));
    console.log('   • Quick deploy: ' + chalk.cyan('focal-deploy push-deploy'));
    console.log('   • With message: ' + chalk.cyan('focal-deploy push-deploy -m "Your message"'));
    console.log('   • Dry run: ' + chalk.cyan('focal-deploy push-deploy --dry-run') + '\n');
  }

  async getCommitHistory() {
    try {
      const commits = await this.gitIntegration.getCommitHistory(process.cwd(), 5);
      
      if (commits.length > 0) {
        console.log(chalk.bold('📚 Recent commits:'));
        commits.forEach(commit => {
          console.log(`   ${chalk.gray(commit.hash)} ${commit.message} ${chalk.dim('(' + commit.author + ')')}`);
        });
        console.log();
      }

    } catch (error) {
      // Silently fail - commit history is not critical
    }
  }

  async getBranchInfo() {
    try {
      const branchInfo = await this.gitIntegration.getBranchInfo(process.cwd());
      
      if (branchInfo) {
        console.log(chalk.bold('🌿 Branch information:'));
        console.log(`   Current: ${chalk.cyan(branchInfo.current)}`);
        
        if (branchInfo.remotes.length > 0) {
          console.log(`   Remote: ${chalk.gray(branchInfo.remotes[0].refs.fetch)}`);
        }
        console.log();
      }

    } catch (error) {
      // Silently fail - branch info is not critical
    }
  }
}

module.exports = { PushDeployCommand };