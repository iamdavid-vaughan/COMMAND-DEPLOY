const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { Logger } = require('./logger');
const { SSHKeyManager } = require('./ssh-key-manager');

class GitHubAPI {
  constructor(token) {
    this.logger = Logger;
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'focal-deploy/1.0.0'
    });
    this.token = token;
  }

  async validateToken() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      this.logger.success(`✅ GitHub token validated for user: ${chalk.cyan(data.login)}`);
      return { valid: true, user: data };
    } catch (error) {
      this.logger.error(`GitHub token validation failed: ${error.message}`);
      return { valid: false, error: error.message };
    }
  }

  async createRepository(repoName, options = {}) {
    try {
      this.logger.info(`🏗️  Creating GitHub repository: ${chalk.cyan(repoName)}`);

      const repoData = {
        name: repoName,
        description: options.description || `${repoName} - Node.js application with focal-deploy`,
        private: options.private || false,
        auto_init: false, // We'll push our own initial commit
        gitignore_template: null, // We generate our own .gitignore
        license_template: null,
        allow_squash_merge: true,
        allow_merge_commit: true,
        allow_rebase_merge: true,
        delete_branch_on_merge: true,
        has_issues: true,
        has_projects: false,
        has_wiki: false,
        has_downloads: true
      };

      const { data } = await this.octokit.rest.repos.createForAuthenticatedUser(repoData);
      
      this.logger.success(`✅ Repository created: ${chalk.cyan(data.html_url)}`);
      
      return {
        success: true,
        repository: {
          name: data.name,
          fullName: data.full_name,
          htmlUrl: data.html_url,
          cloneUrl: data.clone_url,
          sshUrl: data.ssh_url,
          private: data.private,
          owner: data.owner.login
        }
      };

    } catch (error) {
      if (error.status === 422 && error.message.includes('already exists')) {
        this.logger.error(`Repository ${repoName} already exists`);
        return { success: false, error: 'Repository already exists' };
      }
      
      this.logger.error(`Failed to create repository: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getRepository(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });

      return {
        success: true,
        repository: {
          name: data.name,
          fullName: data.full_name,
          htmlUrl: data.html_url,
          cloneUrl: data.clone_url,
          sshUrl: data.ssh_url,
          private: data.private,
          owner: data.owner.login
        }
      };

    } catch (error) {
      if (error.status === 404) {
        return { success: false, error: 'Repository not found' };
      }
      
      this.logger.error(`Failed to get repository: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async addDeployKey(owner, repo, keyTitle, publicKey, readOnly = true) {
    try {
      this.logger.info(`🔑 Adding deploy key to ${chalk.cyan(`${owner}/${repo}`)}`);

      const { data } = await this.octokit.rest.repos.createDeployKey({
        owner,
        repo,
        title: keyTitle,
        key: publicKey,
        read_only: readOnly
      });

      this.logger.success(`✅ Deploy key added: ${chalk.cyan(keyTitle)}`);
      
      return {
        success: true,
        deployKey: {
          id: data.id,
          title: data.title,
          key: data.key,
          readOnly: data.read_only,
          verified: data.verified
        }
      };

    } catch (error) {
      if (error.status === 422 && error.message.includes('key is already in use')) {
        this.logger.warning('Deploy key already exists, continuing...');
        return { success: true, deployKey: { existing: true } };
      }
      
      this.logger.error(`Failed to add deploy key: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async listDeployKeys(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listDeployKeys({
        owner,
        repo
      });

      return {
        success: true,
        deployKeys: data.map(key => ({
          id: key.id,
          title: key.title,
          readOnly: key.read_only,
          verified: key.verified,
          createdAt: key.created_at
        }))
      };

    } catch (error) {
      this.logger.error(`Failed to list deploy keys: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async removeDeployKey(owner, repo, keyId) {
    try {
      await this.octokit.rest.repos.deleteDeployKey({
        owner,
        repo,
        key_id: keyId
      });

      this.logger.success(`✅ Deploy key removed: ${keyId}`);
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to remove deploy key: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async createWebhook(owner, repo, webhookUrl, events = ['push']) {
    try {
      this.logger.info(`🪝 Creating webhook for ${chalk.cyan(`${owner}/${repo}`)}`);

      const { data } = await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        config: {
          url: webhookUrl,
          content_type: 'json',
          insecure_ssl: '0'
        },
        events: events,
        active: true
      });

      this.logger.success(`✅ Webhook created: ${chalk.cyan(webhookUrl)}`);
      
      return {
        success: true,
        webhook: {
          id: data.id,
          url: data.config.url,
          events: data.events,
          active: data.active
        }
      };

    } catch (error) {
      this.logger.error(`Failed to create webhook: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getBranches(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo
      });

      return {
        success: true,
        branches: data.map(branch => ({
          name: branch.name,
          sha: branch.commit.sha,
          protected: branch.protected
        }))
      };

    } catch (error) {
      this.logger.error(`Failed to get branches: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getCommits(owner, repo, branch = 'main', count = 10) {
    try {
      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: count
      });

      return {
        success: true,
        commits: data.map(commit => ({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message,
          author: commit.commit.author.name,
          date: commit.commit.author.date,
          url: commit.html_url
        }))
      };

    } catch (error) {
      this.logger.error(`Failed to get commits: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async checkRepositoryAccess(owner, repo) {
    try {
      // Try to get repository info to check access
      const repoResult = await this.getRepository(owner, repo);
      if (!repoResult.success) {
        return { hasAccess: false, error: repoResult.error };
      }

      // Try to list deploy keys to check admin access
      const keysResult = await this.listDeployKeys(owner, repo);
      const hasAdminAccess = keysResult.success;

      return {
        hasAccess: true,
        hasAdminAccess,
        repository: repoResult.repository
      };

    } catch (error) {
      return { hasAccess: false, error: error.message };
    }
  }

  async parseRepositoryUrl(repoUrl) {
    try {
      // Handle different GitHub URL formats
      let match;
      
      // SSH format: git@github.com:owner/repo.git
      match = repoUrl.match(/git@github\.com:([^\/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }

      // HTTPS format: https://github.com/owner/repo.git
      match = repoUrl.match(/https:\/\/github\.com\/([^\/]+)\/(.+?)(?:\.git)?$/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }

      // Simple format: owner/repo
      match = repoUrl.match(/^([^\/]+)\/(.+)$/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }

      throw new Error('Invalid GitHub repository URL format');

    } catch (error) {
      this.logger.error(`Failed to parse repository URL: ${error.message}`);
      return null;
    }
  }

  async getUserInfo() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return {
        success: true,
        user: {
          login: data.login,
          name: data.name,
          email: data.email,
          avatarUrl: data.avatar_url,
          publicRepos: data.public_repos,
          privateRepos: data.total_private_repos
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async searchRepositories(query, options = {}) {
    try {
      const { data } = await this.octokit.rest.search.repos({
        q: query,
        sort: options.sort || 'updated',
        order: options.order || 'desc',
        per_page: options.limit || 10
      });

      return {
        success: true,
        repositories: data.items.map(repo => ({
          name: repo.name,
          fullName: repo.full_name,
          htmlUrl: repo.html_url,
          description: repo.description,
          private: repo.private,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          updatedAt: repo.updated_at
        })),
        totalCount: data.total_count
      };

    } catch (error) {
      this.logger.error(`Failed to search repositories: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { GitHubAPI };