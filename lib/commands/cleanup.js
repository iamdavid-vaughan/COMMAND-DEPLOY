const chalk = require('chalk');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const { InstanceTracker } = require('../utils/instance-tracker');
const { GitHubCleanupService } = require('../utils/github-cleanup');
const { GitHubRepoTracker } = require('../utils/github-repo-tracker');
const EC2Manager = require('../aws/ec2');
const S3Manager = require('../aws/s3');
const SecurityGroupManager = require('../aws/security-groups');
const SSHKeyManager = require('../aws/ssh-keys');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class CleanupCommand {
  constructor() {
    this.stateManager = new StateManager();
    this.instanceTracker = new InstanceTracker();
    this.githubCleanup = new GitHubCleanupService();
    this.repoTracker = new GitHubRepoTracker();
  }

  async execute(options = {}) {
    try {
      Logger.section('🧹 Focal Deploy Cleanup');
      
      if (options.all) {
        options.aws = true;
        options.github = true;
        options.local = true;
      }
      
      if (options.aws) {
        await this.cleanupAWSResources(options);
      }
      
      if (options.github) {
        await this.cleanupGitHubRepositories(options);
      }
      
      if (options.local) {
        await this.cleanupLocalFiles(options);
      }
      
      // If no specific options, run interactive cleanup
      if (!options.aws && !options.github && !options.local && !options.all) {
        await this.runInteractiveCleanup(options);
      }
      
      Logger.success('✅ Cleanup operations completed');
      
    } catch (error) {
      ErrorHandler.handle(error);
      throw error;
    }
  }

  async runInteractiveCleanup(options) {
    console.log(chalk.blue('🧹 Select cleanup operations to perform:\n'));
    
    const { operations } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'operations',
        message: 'Choose cleanup operations:',
        choices: [
          {
            name: '☁️ Clean up orphaned AWS resources',
            value: 'aws',
            checked: false
          },
          {
            name: '🐙 Clean up GitHub repositories',
            value: 'github',
            checked: false
          },
          {
            name: '📁 Clean up local files (state, SSH keys, configs)',
            value: 'local',
            checked: false
          },
          {
            name: '🗂️ Clean up instance tracking data',
            value: 'tracking',
            checked: true
          }
        ]
      }
    ]);

    if (operations.includes('aws')) {
      await this.cleanupAWSResources(options);
    }
    
    if (operations.includes('github')) {
      await this.cleanupGitHubRepositories(options);
    }
    
    if (operations.includes('local')) {
      await this.cleanupLocalFiles(options);
    }
    
    if (operations.includes('tracking')) {
      await this.cleanupInstanceTracking(options);
    }
  }

  async cleanupAWSResources(options) {
    Logger.info('☁️ Cleaning up orphaned AWS resources...');
    
    try {
      // Find all state files to identify AWS resources
      const stateFiles = glob.sync('**/.focal-deploy/state.json', { 
        cwd: process.cwd(),
        absolute: true 
      });
      
      const allResources = {
        ec2Instances: new Set(),
        s3Buckets: new Set(),
        securityGroups: new Set(),
        sshKeys: new Set()
      };
      
      // Collect all resources from state files
      for (const stateFile of stateFiles) {
        try {
          const state = await fs.readJson(stateFile);
          if (state.resources) {
            if (state.resources.ec2Instance?.instanceId) {
              allResources.ec2Instances.add(state.resources.ec2Instance.instanceId);
            }
            if (state.resources.s3Bucket?.name) {
              allResources.s3Buckets.add(state.resources.s3Bucket.name);
            }
            if (state.resources.securityGroup?.id) {
              allResources.securityGroups.add(state.resources.securityGroup.id);
            }
            if (state.resources.sshKey?.name) {
              allResources.sshKeys.add(state.resources.sshKey.name);
            }
          }
        } catch (error) {
          Logger.warning(`Failed to read state file ${stateFile}: ${error.message}`);
        }
      }
      
      if (options.dryRun) {
        Logger.info('🔍 Dry run - would check for orphaned resources:');
        console.log(`   EC2 Instances: ${allResources.ec2Instances.size}`);
        console.log(`   S3 Buckets: ${allResources.s3Buckets.size}`);
        console.log(`   Security Groups: ${allResources.securityGroups.size}`);
        console.log(`   SSH Keys: ${allResources.sshKeys.size}`);
        return;
      }
      
      // TODO: Implement actual AWS resource cleanup
      // This would require:
      // 1. Loading AWS credentials
      // 2. Querying actual AWS resources
      // 3. Comparing with state files
      // 4. Identifying orphaned resources
      // 5. Prompting for confirmation
      // 6. Deleting orphaned resources
      
      Logger.info('AWS resource cleanup is not yet fully implemented');
      Logger.info('This would check for resources not tracked in any state file');
      
    } catch (error) {
      Logger.error(`Failed to cleanup AWS resources: ${error.message}`);
    }
  }

  async cleanupGitHubRepositories(options) {
    Logger.info('🐙 Cleaning up GitHub repositories...');
    
    try {
      // Get GitHub token - first check environment variable
      let githubToken = process.env.GITHUB_TOKEN;
      
      if (!githubToken) {
        // Prompt user for GitHub token
        Logger.info('GitHub token is required to clean up repositories.');
        Logger.info('💡 To generate a token, visit: https://github.com/settings/tokens');
        Logger.info('   Required permissions for repository deletion:');
        Logger.info('   • delete_repo (recommended) - allows repository deletion');
        Logger.info('   • repo (full access) - includes delete_repo and other permissions');
        Logger.info('   Note: Classic tokens need "delete_repo" scope, fine-grained tokens need "Administration: Write"');
        
        const tokenPrompt = await inquirer.prompt([
          {
            type: 'password',
            name: 'token',
            message: 'Enter your GitHub Personal Access Token:',
            mask: '*',
            validate: (input) => {
              if (!input || input.trim().length === 0) {
                return 'GitHub token is required';
              }
              if (input.trim().length < 20) {
                return 'GitHub token appears to be too short. Please check and try again.';
              }
              return true;
            }
          }
        ]);
        
        githubToken = tokenPrompt.token.trim();
      }
      
      // Validate the token by attempting to authenticate
      Logger.info('🔐 Validating GitHub token...');
      try {
        const authResult = await this.githubCleanup.authenticate(githubToken);
        Logger.success('✅ GitHub token validated successfully');
        
        // Warn if token lacks delete permissions
        if (!authResult.hasDeleteRepo) {
          Logger.warning('⚠️  Your token may not have sufficient permissions for repository deletion');
          Logger.info('💡 If deletions fail, update your token with "delete_repo" scope');
        }
      } catch (error) {
        Logger.error(`❌ Invalid GitHub token: ${error.message}`);
        Logger.info('Please check your token and try again.');
        Logger.info('💡 Make sure your token has the required permissions:');
        Logger.info('   • delete_repo (for repository deletion)');
        Logger.info('   • repo (for full repository access)');
        return;
      }

      
      // Get all repositories from GitHub
      const allRepos = await this.githubCleanup.getAllRepositories();
      
      // Filter to only focal-deploy repositories using our tracker
      const focalDeployRepos = await this.repoTracker.filterFocalDeployRepositories(allRepos);
      
      if (focalDeployRepos.length === 0) {
        Logger.success('✅ No focal-deploy repositories found to clean up');
        return;
      }
      
      if (options.dryRun) {
        Logger.info(`🔍 Dry run - would clean up ${focalDeployRepos.length} focal-deploy repositories:`);
        focalDeployRepos.forEach(repo => {
          console.log(`   • ${repo.name} (${repo.html_url})`);
        });
        return;
      }
      
      // Show tracked repositories
      const trackedRepos = await this.repoTracker.getAllFocalDeployRepositories();
      if (trackedRepos.length > 0) {
        Logger.info(`📋 Found ${trackedRepos.length} tracked focal-deploy repositories`);
        trackedRepos.forEach(repo => {
          console.log(chalk.cyan(`   • ${repo.name} (tracked)`));
        });
      }
      
      // Interactive selection
      const selectedRepos = await this.githubCleanup.interactiveRepositorySelection(focalDeployRepos);
      
      if (selectedRepos.length > 0) {
        const confirmed = await this.githubCleanup.confirmDeletion(selectedRepos);
        if (confirmed) {
          // Delete repositories and untrack them
          let deletedCount = 0;
          let failedCount = 0;
          
          for (const repo of selectedRepos) {
            try {
              const result = await this.githubCleanup.deleteRepository(repo);
              if (result.success) {
                deletedCount++;
                // Only attempt to untrack if the repository was successfully deleted
                await this.repoTracker.untrackRepository(repo.name);
              } else {
                failedCount++;
                Logger.error(`❌ Failed to delete repository ${repo.name}: ${result.error}`);
                Logger.info(`ℹ️ Untracked GitHub repository: ${repo.name}`);
              }
            } catch (error) {
              failedCount++;
              Logger.error(`❌ Failed to delete repository ${repo.name}: ${error.message}`);
              Logger.info(`ℹ️ Untracked GitHub repository: ${repo.name}`);
            }
          }
          
          if (deletedCount > 0) {
            Logger.success(`✅ ✅ Deleted and untracked ${deletedCount} repositories`);
          }
          if (failedCount > 0) {
            Logger.warning(`⚠️ Failed to delete ${failedCount} repositories`);
          }
        }
      }
      
    } catch (error) {
      Logger.error(`Failed to cleanup GitHub repositories: ${error.message}`);
    }
  }

  async cleanupLocalFiles(options) {
    Logger.info('📁 Cleaning up local deployment files (state, SSH keys, configs)...');
    
    try {
      const tempPatterns = [
        '**/.focal-deploy/temp/**',
        '**/.focal-deploy/*.tmp',
        '**/.focal-deploy/*.log',
        '**/.focal-deploy/state.json',
        '**/.focal-deploy/instance-state.json',
        '**/.focal-deploy/global-instances.json',
        '**/.focal-deploy/ssh-keys/**',
        '**/.focal-deploy/*.pem',
        '**/.focal-deploy/*.key',
        '**/.focal-deploy/*.pub',
        '**/focal-deploy-*.tmp',
        '**/ssh-test-*.js',
        '**/test-ssh-connection-*.js',
        '**/.focal-deploy/backup-*/**',
        '**/.focal-deploy/credentials/**',
        '**/.focal-deploy/config/**',
        '**/.focal-deploy/github-repos.json',
        '**/.focal-deploy/global-github-repos.json'
      ];
      
      let cleanedCount = 0;
      const filesToClean = [];
      
      // Collect all files to clean
      for (const pattern of tempPatterns) {
        const files = glob.sync(pattern, { 
          cwd: process.cwd(),
          absolute: true 
        });
        filesToClean.push(...files);
      }
      
      if (filesToClean.length === 0) {
        Logger.success('✅ No deployment files to clean up');
        return;
      }
      
      if (options.dryRun) {
        Logger.info(`🔍 Dry run - would clean up ${filesToClean.length} file(s):`);
        filesToClean.forEach(file => {
          console.log(`   ${path.relative(process.cwd(), file)}`);
        });
        return;
      }
      
      // Show what will be cleaned
      Logger.warning(`Found ${filesToClean.length} file(s) to clean up:`);
      filesToClean.forEach(file => {
        console.log(chalk.yellow(`  • ${path.relative(process.cwd(), file)}`));
      });
      
      // Confirm cleanup
      const { shouldCleanup } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldCleanup',
          message: `⚠️  This will permanently delete all deployment state, SSH keys, and configuration files. Continue?`,
          default: false
        }
      ]);
      
      if (!shouldCleanup) {
        Logger.info('Cleanup cancelled');
        return;
      }
      
      // Clean up files
      for (const file of filesToClean) {
        try {
          await fs.remove(file);
          cleanedCount++;
          Logger.info(`Removed: ${path.relative(process.cwd(), file)}`);
        } catch (removeError) {
          Logger.warning(`Failed to remove ${file}: ${removeError.message}`);
        }
      }
      
      Logger.success(`✅ Cleaned up ${cleanedCount} deployment file(s)`);
      Logger.info('All local deployment state, SSH keys, and configuration files have been removed');
      
    } catch (error) {
      Logger.error(`Failed to cleanup local files: ${error.message}`);
    }
  }

  async cleanupInstanceTracking(options) {
    Logger.info('🗂️ Cleaning up instance tracking data...');
    
    try {
      const instances = await this.instanceTracker.getAllInstances();
      const orphanedInstances = [];
      
      for (const instanceId of Object.keys(instances)) {
        const instanceData = instances[instanceId];
        
        // Check if the project directory still exists
        if (instanceData.projectPath && !await fs.pathExists(instanceData.projectPath)) {
          orphanedInstances.push({
            id: instanceId,
            reason: 'Project directory no longer exists',
            data: instanceData
          });
        }
      }
      
      if (orphanedInstances.length === 0) {
        Logger.success('✅ No orphaned instance tracking data found');
        return;
      }
      
      if (options.dryRun) {
        Logger.info(`🔍 Dry run - would clean up ${orphanedInstances.length} orphaned instance(s):`);
        orphanedInstances.forEach(orphan => {
          console.log(`   ${orphan.id}: ${orphan.reason}`);
        });
        return;
      }
      
      Logger.warning(`Found ${orphanedInstances.length} orphaned instance(s):`);
      orphanedInstances.forEach(orphan => {
        console.log(chalk.yellow(`  • ${orphan.id}: ${orphan.reason}`));
      });
      
      const { shouldCleanup } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldCleanup',
          message: 'Clean up orphaned instance tracking data?',
          default: true
        }
      ]);
      
      if (shouldCleanup) {
        for (const orphan of orphanedInstances) {
          await this.instanceTracker.destroyInstance(orphan.id);
          Logger.success(`✅ Cleaned up orphaned instance: ${orphan.id}`);
        }
      }
      
    } catch (error) {
      Logger.error(`Failed to cleanup instance tracking: ${error.message}`);
    }
  }
}

module.exports = { CleanupCommand };