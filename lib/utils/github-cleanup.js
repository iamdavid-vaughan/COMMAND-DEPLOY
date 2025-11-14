/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 *
 * This file is part of Focal Deploy, a proprietary deployment automation platform.
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without express written permission.
 *
 * Licensed under the Focal Deploy Proprietary License.
 * See LICENSE file in the project root for license information.
 *
 * For licensing inquiries: licensing@focal-deploy.com
 * For support: support@focal-deploy.com
 *
 * @author Focal Deploy Team
 * @copyright 2025 Focal Deploy
 * @license Proprietary
 */

const { Octokit } = require('@octokit/rest');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { logger } = require('./logger');

class GitHubCleanupService {
  constructor() {
    this.octokit = null;
    this.authenticated = false;
  }

  async authenticate(token) {
    try {
      this.octokit = new Octokit({
        auth: token,
      });

      // Test authentication and get token scopes
      const { data: user, headers } = await this.octokit.rest.users.getAuthenticated();
      this.authenticated = true;
      this.user = user;
      
      // Check token scopes
      const scopes = (headers['x-oauth-scopes'] || '').split(', ').filter(s => s);
      this.tokenScopes = scopes;
      
      logger.info(`Authenticated as GitHub user: ${user.login}`);
      
      // Check for delete_repo permission
      const hasDeleteRepo = scopes.includes('delete_repo') || scopes.includes('repo');
      if (!hasDeleteRepo) {
        logger.warn('⚠️  Token missing delete_repo permission - repository deletion may fail');
        logger.info('💡 Current token scopes:', scopes.join(', '));
        logger.info('💡 Required scopes: delete_repo (or repo for full access)');
      } else {
        logger.info('✅ Token has repository deletion permissions');
      }
      
      return { user, scopes, hasDeleteRepo };
    } catch (error) {
      logger.error('GitHub authentication failed:', error.message);
      throw new Error('Failed to authenticate with GitHub. Please check your token.');
    }
  }

  async getAllRepositories() {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub');
    }

    try {
      const repositories = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
          per_page: 100,
          page: page,
          sort: 'updated',
          direction: 'desc'
        });

        repositories.push(...data);
        hasMore = data.length === 100;
        page++;
      }

      return repositories;
    } catch (error) {
      logger.error('Failed to fetch repositories:', error.message);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  async getFocalDeployRepositories() {
    const allRepos = await this.getAllRepositories();
    
    // Filter repositories that might be focal-deploy related
    const focalRepos = allRepos.filter(repo => {
      const name = repo.name.toLowerCase();
      const description = (repo.description || '').toLowerCase();
      
      return (
        name.includes('focal') ||
        name.includes('deploy') ||
        name.includes('test-') ||
        description.includes('focal') ||
        description.includes('deploy') ||
        repo.topics?.some(topic => topic.includes('focal') || topic.includes('deploy'))
      );
    });

    return focalRepos;
  }

  async interactiveRepositorySelection(repositories) {
    if (repositories.length === 0) {
      console.log(chalk.yellow('No repositories found matching focal-deploy criteria.'));
      return [];
    }

    console.log(chalk.blue(`\n📋 Found ${repositories.length} repositories that might be focal-deploy related:\n`));

    // Display repositories with details
    repositories.forEach((repo, index) => {
      const lastUpdated = new Date(repo.updated_at).toLocaleDateString();
      const size = repo.size > 1024 ? `${(repo.size / 1024).toFixed(1)}MB` : `${repo.size}KB`;
      
      console.log(chalk.cyan(`${index + 1}. ${repo.name}`));
      console.log(chalk.gray(`   📝 ${repo.description || 'No description'}`));
      console.log(chalk.gray(`   🔗 ${repo.html_url}`));
      console.log(chalk.gray(`   📅 Last updated: ${lastUpdated} | 📦 Size: ${size} | ⭐ Stars: ${repo.stargazers_count}`));
      console.log('');
    });

    const choices = repositories.map((repo, index) => ({
      name: `${repo.name} (${repo.description || 'No description'})`,
      value: repo,
      checked: false
    }));

    choices.push(new inquirer.Separator());
    choices.push({
      name: chalk.red('🗑️  Select All for Deletion (DANGEROUS)'),
      value: 'SELECT_ALL',
      checked: false
    });

    const { selectedRepos } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedRepos',
        message: 'Select repositories to delete (use spacebar to select, enter to confirm):',
        choices: choices,
        pageSize: 15
      }
    ]);

    if (selectedRepos.includes('SELECT_ALL')) {
      const { confirmSelectAll } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmSelectAll',
          message: chalk.red('⚠️  Are you ABSOLUTELY SURE you want to delete ALL repositories? This cannot be undone!'),
          default: false
        }
      ]);

      if (confirmSelectAll) {
        return repositories;
      } else {
        console.log(chalk.yellow('Selection cancelled.'));
        return [];
      }
    }

    return selectedRepos.filter(repo => repo !== 'SELECT_ALL');
  }

  async confirmDeletion(repositories) {
    if (repositories.length === 0) {
      return false;
    }

    console.log(chalk.red('\n⚠️  DANGER ZONE ⚠️'));
    console.log(chalk.red('You are about to permanently delete the following repositories:\n'));

    repositories.forEach(repo => {
      console.log(chalk.red(`  🗑️  ${repo.name} (${repo.html_url})`));
    });

    console.log(chalk.red('\n⚠️  This action CANNOT be undone!'));
    console.log(chalk.red('⚠️  All code, issues, pull requests, and history will be lost!'));

    const { confirmDeletion } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDeletion',
        message: chalk.red('Type "yes" to confirm deletion:'),
        default: false
      }
    ]);

    if (confirmDeletion) {
      const { finalConfirmation } = await inquirer.prompt([
        {
          type: 'input',
          name: 'finalConfirmation',
          message: chalk.red('Type "DELETE" in capital letters to proceed:'),
          validate: (input) => {
            if (input === 'DELETE') {
              return true;
            }
            return 'You must type "DELETE" exactly to confirm.';
          }
        }
      ]);

      return finalConfirmation === 'DELETE';
    }

    return false;
  }

  async deleteRepository(repo) {
    try {
      await this.octokit.rest.repos.delete({
        owner: repo.owner.login,
        repo: repo.name
      });
      
      logger.info(`Successfully deleted repository: ${repo.name}`);
      return { success: true, repo: repo.name };
    } catch (error) {
      let errorMessage = error.message;
      let suggestions = [];
      
      if (error.status === 403 && error.message.includes('admin rights')) {
        errorMessage = 'Must have admin rights to Repository';
        suggestions = [
          'Your GitHub token lacks the "delete_repo" permission',
          'Visit https://github.com/settings/tokens to create a new token',
          'Ensure the token has "delete_repo" scope (or "repo" for full access)',
          'If using fine-grained tokens, ensure "Administration" permission is set to "Write"'
        ];
      } else if (error.status === 403) {
        errorMessage = 'Permission denied - insufficient repository access';
        suggestions = [
          'Check if you have admin access to this repository',
          'Verify your token has the correct permissions',
          'Repository may be owned by an organization requiring different permissions'
        ];
      } else if (error.status === 404) {
        errorMessage = 'Repository not found (may already be deleted)';
        // Consider 404 as success since the goal is achieved
        logger.warn(`Repository ${repo.name} not found (may already be deleted)`);
        return { success: true, repo: repo.name, warning: 'Repository already deleted' };
      }
      
      logger.error(`Failed to delete repository ${repo.name}: ${errorMessage}`);
      if (suggestions.length > 0) {
        logger.info('💡 Suggestions:');
        suggestions.forEach(suggestion => {
          logger.info(`  • ${suggestion}`);
        });
      }
      
      return { 
        success: false, 
        repo: repo.name, 
        error: errorMessage,
        suggestions,
        status: error.status 
      };
    }
  }

  async deleteRepositories(repositories) {
    const results = [];
    let permissionErrors = 0;
    
    console.log(chalk.blue(`\n🗑️  Deleting ${repositories.length} repositories...\n`));

    for (const repo of repositories) {
      console.log(chalk.yellow(`Deleting ${repo.name}...`));
      const result = await this.deleteRepository(repo);
      results.push(result);

      if (result.success) {
        if (result.warning) {
          console.log(chalk.yellow(`⚠️  ${repo.name}: ${result.warning}`));
        } else {
          console.log(chalk.green(`✅ Successfully deleted ${repo.name}`));
        }
      } else {
        console.log(chalk.red(`❌ Failed to delete ${repo.name}: ${result.error}`));
        if (result.status === 403) {
          permissionErrors++;
        }
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Provide summary and guidance if there were permission errors
    if (permissionErrors > 0) {
      console.log(chalk.yellow(`\n⚠️  ${permissionErrors} repositories failed due to permission issues`));
      console.log(chalk.white('\n💡 To fix permission errors:'));
      console.log(chalk.white('  1. Visit https://github.com/settings/tokens'));
      console.log(chalk.white('  2. Create a new token or edit existing token'));
      console.log(chalk.white('  3. Ensure "delete_repo" scope is selected (or "repo" for full access)'));
      console.log(chalk.white('  4. Update your GITHUB_TOKEN environment variable'));
      console.log(chalk.white('  5. Re-run the cleanup command'));
      
      if (this.tokenScopes && this.tokenScopes.length > 0) {
        console.log(chalk.gray(`\nCurrent token scopes: ${this.tokenScopes.join(', ')}`));
      }
    }

    return results;
  }

  async getRepositoryByName(name) {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub');
    }

    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: user.login,
        repo: name
      });
      return repo;
    } catch (error) {
      if (error.status === 404) {
        return null; // Repository doesn't exist
      }
      throw error;
    }
  }

  async deleteRepositoryByName(name) {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub');
    }

    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      await this.octokit.rest.repos.delete({
        owner: user.login,
        repo: name
      });
      
      logger.info(`Successfully deleted repository: ${name}`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        logger.warn(`Repository ${name} not found (may already be deleted)`);
        return true; // Consider it successful if already deleted
      }
      logger.error(`Failed to delete repository ${name}:`, error.message);
      return false;
    }
  }
}

module.exports = { GitHubCleanupService };