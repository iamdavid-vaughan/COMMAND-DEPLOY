#!/usr/bin/env node

const { GitHubCleanupService } = require('../lib/utils/github-cleanup');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log(chalk.bold.blue('🧹 GitHub Repository Cleanup Tool'));
  console.log(chalk.gray('This tool helps you clean up focal-deploy related repositories\n'));

  try {
    // Get GitHub token
    let token = process.env.GITHUB_TOKEN;
    
    if (!token) {
      const { inputToken } = await inquirer.prompt([
        {
          type: 'password',
          name: 'inputToken',
          message: 'Enter your GitHub Personal Access Token:',
          mask: '*',
          validate: (input) => {
            if (!input || input.length < 10) {
              return 'Please enter a valid GitHub token';
            }
            return true;
          }
        }
      ]);
      token = inputToken;
    }

    // Initialize cleanup service
    const cleanupService = new GitHubCleanupService();
    
    console.log(chalk.yellow('🔐 Authenticating with GitHub...'));
    const user = await cleanupService.authenticate(token);
    console.log(chalk.green(`✅ Authenticated as: ${user.login}\n`));

    // Get cleanup mode
    const { cleanupMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'cleanupMode',
        message: 'Select cleanup mode:',
        choices: [
          {
            name: '🎯 Smart Cleanup (focal-deploy related repos only)',
            value: 'smart'
          },
          {
            name: '📋 All Repositories (manual selection)',
            value: 'all'
          },
          {
            name: '🔍 Search by Name Pattern',
            value: 'search'
          }
        ]
      }
    ]);

    let repositories = [];

    switch (cleanupMode) {
      case 'smart':
        console.log(chalk.yellow('🔍 Fetching focal-deploy related repositories...'));
        repositories = await cleanupService.getFocalDeployRepositories();
        break;
        
      case 'all':
        console.log(chalk.yellow('🔍 Fetching all repositories...'));
        repositories = await cleanupService.getAllRepositories();
        break;
        
      case 'search':
        const { searchPattern } = await inquirer.prompt([
          {
            type: 'input',
            name: 'searchPattern',
            message: 'Enter search pattern (e.g., "test-", "focal", "deploy"):',
            validate: (input) => {
              if (!input || input.length < 2) {
                return 'Please enter a search pattern with at least 2 characters';
              }
              return true;
            }
          }
        ]);
        
        console.log(chalk.yellow(`🔍 Searching repositories matching "${searchPattern}"...`));
        const allRepos = await cleanupService.getAllRepositories();
        repositories = allRepos.filter(repo => 
          repo.name.toLowerCase().includes(searchPattern.toLowerCase()) ||
          (repo.description && repo.description.toLowerCase().includes(searchPattern.toLowerCase()))
        );
        break;
    }

    if (repositories.length === 0) {
      console.log(chalk.yellow('No repositories found matching the criteria.'));
      process.exit(0);
    }

    // Interactive selection
    const selectedRepos = await cleanupService.interactiveRepositorySelection(repositories);
    
    if (selectedRepos.length === 0) {
      console.log(chalk.yellow('No repositories selected for deletion.'));
      process.exit(0);
    }

    // Confirm deletion
    const confirmed = await cleanupService.confirmDeletion(selectedRepos);
    
    if (!confirmed) {
      console.log(chalk.yellow('Deletion cancelled.'));
      process.exit(0);
    }

    // Perform deletion
    const results = await cleanupService.deleteRepositories(selectedRepos);
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.blue('\n📊 Cleanup Summary:'));
    console.log(chalk.green(`✅ Successfully deleted: ${successful} repositories`));
    
    if (failed > 0) {
      console.log(chalk.red(`❌ Failed to delete: ${failed} repositories`));
      console.log(chalk.yellow('\nFailed repositories:'));
      results.filter(r => !r.success).forEach(result => {
        console.log(chalk.red(`  - ${result.repo}: ${result.error}`));
      });
    }

    console.log(chalk.green('\n🎉 Cleanup completed!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error during cleanup:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Cleanup interrupted by user'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n⚠️  Cleanup terminated'));
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { main };