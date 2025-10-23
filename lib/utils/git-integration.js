const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { Logger } = require('./logger');

class GitIntegration {
  constructor() {
    this.logger = Logger;
  }

  async initializeRepository(targetPath, context) {
    try {
      this.logger.info(`🔧 Initializing Git repository for ${chalk.cyan(context.projectName)}...`);

      const git = simpleGit(targetPath);

      // Initialize Git repository
      await git.init();
      this.logger.success('✅ Git repository initialized');

      // Configure Git user if not set globally
      try {
        await git.addConfig('user.name', context.gitUser || 'focal-deploy');
        await git.addConfig('user.email', context.gitEmail || 'deploy@focal-deploy.local');
      } catch (error) {
        // Git config might already be set globally, continue
        this.logger.info('Using existing Git configuration');
      }

      // Add all files
      await git.add('.');
      this.logger.success('✅ Files staged for commit');

      // Create initial commit
      const commitMessage = `Initial commit: ${context.projectName} created with focal-deploy

Generated on ${new Date().toISOString()}
Template: Node.js + Express
focal-deploy version: ${context.focalDeployVersion || '1.0.0'}`;

      await git.commit(commitMessage);
      this.logger.success('✅ Initial commit created');

      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to initialize Git repository: ${error.message}`);
      throw error;
    }
  }

  async setupRemoteAndPush(targetPath, repoUrl) {
    try {
      if (!repoUrl) {
        this.logger.info('No GitHub repository specified, skipping remote setup');
        return false;
      }

      this.logger.info(`🔗 Setting up remote repository: ${chalk.cyan(repoUrl)}`);

      const git = simpleGit(targetPath);

      // Add remote origin
      await git.addRemote('origin', repoUrl);
      this.logger.success('✅ Remote origin added');

      // Set upstream branch
      await git.push(['-u', 'origin', 'main']);
      this.logger.success('✅ Initial push to remote repository');

      return true;

    } catch (error) {
      this.logger.error(`Failed to setup remote repository: ${error.message}`);
      throw error;
    }
  }

  async validateGitInstallation() {
    try {
      const git = simpleGit();
      await git.version();
      return true;
    } catch (error) {
      this.logger.error('Git is not installed or not accessible');
      return false;
    }
  }

  async checkGitStatus(targetPath) {
    try {
      const git = simpleGit(targetPath);
      const status = await git.status();
      return status;
    } catch (error) {
      this.logger.error(`Failed to check Git status: ${error.message}`);
      return null;
    }
  }

  async pullLatestChanges(targetPath, branch = 'main') {
    try {
      this.logger.info(`🔄 Pulling latest changes from ${chalk.cyan(branch)}...`);

      const git = simpleGit(targetPath);
      
      // Fetch latest changes
      await git.fetch();
      
      // Pull changes
      await git.pull('origin', branch);
      
      this.logger.success('✅ Latest changes pulled successfully');
      return true;

    } catch (error) {
      this.logger.error(`Failed to pull changes: ${error.message}`);
      throw error;
    }
  }

  async commitAndPush(targetPath, message, branch = 'main') {
    try {
      this.logger.info(`📝 Committing and pushing changes...`);

      const git = simpleGit(targetPath);
      
      // Check if there are changes to commit
      const status = await git.status();
      if (status.files.length === 0) {
        this.logger.info('No changes to commit');
        return false;
      }

      // Add all changes
      await git.add('.');
      
      // Commit changes
      await git.commit(message);
      
      // Push to remote
      await git.push('origin', branch);
      
      this.logger.success('✅ Changes committed and pushed successfully');
      return true;

    } catch (error) {
      this.logger.error(`Failed to commit and push: ${error.message}`);
      throw error;
    }
  }

  async cloneRepository(repoUrl, targetPath, deployKeyPath = null) {
    try {
      this.logger.info(`📥 Cloning repository: ${chalk.cyan(repoUrl)}`);

      const git = simpleGit();
      
      // Configure SSH if deploy key is provided
      if (deployKeyPath && await fs.pathExists(deployKeyPath)) {
        const sshCommand = `ssh -i ${deployKeyPath} -o StrictHostKeyChecking=no`;
        await git.env('GIT_SSH_COMMAND', sshCommand);
      }

      // Clone repository
      await git.clone(repoUrl, targetPath);
      
      this.logger.success('✅ Repository cloned successfully');
      return true;

    } catch (error) {
      this.logger.error(`Failed to clone repository: ${error.message}`);
      throw error;
    }
  }

  async getBranchInfo(targetPath) {
    try {
      const git = simpleGit(targetPath);
      const branches = await git.branch();
      const remotes = await git.getRemotes(true);
      
      return {
        current: branches.current,
        all: branches.all,
        remotes: remotes
      };

    } catch (error) {
      this.logger.error(`Failed to get branch info: ${error.message}`);
      return null;
    }
  }

  async getCommitHistory(targetPath, count = 5) {
    try {
      const git = simpleGit(targetPath);
      const log = await git.log({ maxCount: count });
      
      return log.all.map(commit => ({
        hash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: commit.date
      }));

    } catch (error) {
      this.logger.error(`Failed to get commit history: ${error.message}`);
      return [];
    }
  }

  async createBranch(targetPath, branchName) {
    try {
      this.logger.info(`🌿 Creating branch: ${chalk.cyan(branchName)}`);

      const git = simpleGit(targetPath);
      await git.checkoutLocalBranch(branchName);
      
      this.logger.success(`✅ Branch ${branchName} created and checked out`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to create branch: ${error.message}`);
      throw error;
    }
  }

  async switchBranch(targetPath, branchName) {
    try {
      this.logger.info(`🔄 Switching to branch: ${chalk.cyan(branchName)}`);

      const git = simpleGit(targetPath);
      await git.checkout(branchName);
      
      this.logger.success(`✅ Switched to branch ${branchName}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to switch branch: ${error.message}`);
      throw error;
    }
  }

  async isGitRepository(targetPath) {
    try {
      const gitDir = path.join(targetPath, '.git');
      return await fs.pathExists(gitDir);
    } catch (error) {
      return false;
    }
  }

  async getRepositoryUrl(targetPath) {
    try {
      const git = simpleGit(targetPath);
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(remote => remote.name === 'origin');
      return origin ? origin.refs.fetch : null;
    } catch (error) {
      return null;
    }
  }

  async validateRepository(targetPath) {
    try {
      const isRepo = await this.isGitRepository(targetPath);
      if (!isRepo) {
        return { valid: false, error: 'Not a Git repository' };
      }

      const git = simpleGit(targetPath);
      const status = await git.status();
      const remotes = await git.getRemotes(true);
      
      return {
        valid: true,
        status: status,
        remotes: remotes,
        hasRemote: remotes.length > 0
      };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = { GitIntegration };