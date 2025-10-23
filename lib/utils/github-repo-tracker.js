const fs = require('fs-extra');
const path = require('path');
const { Logger } = require('./logger');

class GitHubRepoTracker {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.focal-deploy');
    this.repoTrackingFile = path.join(this.stateDir, 'github-repos.json');
    this.globalRepoTrackingFile = path.join(this.stateDir, 'global-github-repos.json');
  }

  /**
   * Track a repository created by focal-deploy
   */
  async trackRepository(repoData) {
    try {
      // Ensure state directory exists
      await fs.ensureDir(this.stateDir);

      const trackingData = {
        name: repoData.name,
        fullName: repoData.full_name,
        url: repoData.html_url,
        cloneUrl: repoData.clone_url,
        sshUrl: repoData.ssh_url,
        createdAt: repoData.created_at || new Date().toISOString(),
        trackedAt: new Date().toISOString(),
        projectPath: this.projectRoot,
        instanceId: repoData.instanceId,
        deploymentId: repoData.deploymentId,
        tags: ['focal-deploy', 'auto-created'],
        metadata: {
          description: repoData.description,
          private: repoData.private,
          size: repoData.size,
          language: repoData.language
        }
      };

      // Load existing tracked repos
      const trackedRepos = await this.getTrackedRepositories();
      
      // Add or update the repository
      trackedRepos[repoData.name] = trackingData;
      
      // Save to local tracking file
      await fs.writeJson(this.repoTrackingFile, trackedRepos, { spaces: 2 });
      
      // Also save to global tracking
      await this.addToGlobalTracking(trackingData);
      
      Logger.info(`Tracked GitHub repository: ${repoData.name}`);
      return trackingData;
      
    } catch (error) {
      Logger.error(`Failed to track repository ${repoData.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all repositories tracked by this project
   */
  async getTrackedRepositories() {
    try {
      if (await fs.pathExists(this.repoTrackingFile)) {
        return await fs.readJson(this.repoTrackingFile);
      }
      return {};
    } catch (error) {
      Logger.warning(`Failed to load tracked repositories: ${error.message}`);
      return {};
    }
  }

  /**
   * Get all repositories tracked globally across all focal-deploy projects
   */
  async getGlobalTrackedRepositories() {
    try {
      if (await fs.pathExists(this.globalRepoTrackingFile)) {
        return await fs.readJson(this.globalRepoTrackingFile);
      }
      return {};
    } catch (error) {
      Logger.warning(`Failed to load global tracked repositories: ${error.message}`);
      return {};
    }
  }

  /**
   * Add repository to global tracking
   */
  async addToGlobalTracking(repoData) {
    try {
      const globalRepos = await this.getGlobalTrackedRepositories();
      globalRepos[repoData.name] = repoData;
      await fs.writeJson(this.globalRepoTrackingFile, globalRepos, { spaces: 2 });
    } catch (error) {
      Logger.warning(`Failed to add to global tracking: ${error.message}`);
    }
  }

  /**
   * Remove repository from tracking
   */
  async untrackRepository(repoName) {
    try {
      let wasTracked = false;
      
      // Remove from local tracking
      const trackedRepos = await this.getTrackedRepositories();
      if (trackedRepos[repoName]) {
        delete trackedRepos[repoName];
        await fs.writeJson(this.repoTrackingFile, trackedRepos, { spaces: 2 });
        wasTracked = true;
      }
      
      // Remove from global tracking
      const globalRepos = await this.getGlobalTrackedRepositories();
      if (globalRepos[repoName]) {
        delete globalRepos[repoName];
        await fs.writeJson(this.globalRepoTrackingFile, globalRepos, { spaces: 2 });
        wasTracked = true;
      }
      
      // Only log if the repository was actually tracked
      if (wasTracked) {
        Logger.info(`Untracked GitHub repository: ${repoName}`);
      }
      
    } catch (error) {
      Logger.error(`Failed to untrack repository ${repoName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get repositories that should be cleaned up for this project
   */
  async getRepositoriesForCleanup() {
    const trackedRepos = await this.getTrackedRepositories();
    return Object.values(trackedRepos);
  }

  /**
   * Get all focal-deploy repositories across all projects
   */
  async getAllFocalDeployRepositories() {
    const globalRepos = await this.getGlobalTrackedRepositories();
    return Object.values(globalRepos);
  }

  /**
   * Check if a repository is tracked by focal-deploy
   */
  async isRepositoryTracked(repoName) {
    const globalRepos = await this.getGlobalTrackedRepositories();
    return globalRepos.hasOwnProperty(repoName);
  }

  /**
   * Filter repositories to only include those created by focal-deploy
   */
  async filterFocalDeployRepositories(allRepositories) {
    const globalRepos = await this.getGlobalTrackedRepositories();
    const trackedNames = Object.keys(globalRepos);
    
    // Protected repositories that should never be cleaned up
    const protectedRepos = [
      'focal-tnid-risk-tool',
      'focal-deploy',
      'focal-core',
      'focal-cli'
    ];
    
    return allRepositories.filter(repo => {
      // Never include protected repositories
      if (protectedRepos.includes(repo.name.toLowerCase())) {
        return false;
      }
      
      // Check if explicitly tracked
      if (trackedNames.includes(repo.name)) {
        return true;
      }
      
      // Check for focal-deploy indicators in the repository
      const name = repo.name.toLowerCase();
      const description = (repo.description || '').toLowerCase();
      const topics = repo.topics || [];
      
      // Specific patterns for focal-deploy test repositories
      const focalDeployTestPatterns = [
        // Timestamp-based test repositories (most common pattern)
        /^focal-\d{13}$/,                    // focal-1760883933543
        /^focal-prod-v?\d*-\d{13}$/,         // focal-prod-v1-1761059123203, focal-prod-1760906887198
        /^focal-dv-test-\d{13}$/,            // focal-dv-test-1761141308566
        /^fresh-focal-deploy-test-\d{13}$/,  // fresh-focal-deploy-test-1761163646276
        /^test-focal-\d{13}$/,               // test-focal-[timestamp]
        /^focal-test-\d{13}$/,               // focal-test-[timestamp]
        
        // Other test patterns
        /^focal-deploy-test-\d+$/,           // focal-deploy-test-123
        /^test-deploy-focal-\d+$/,           // test-deploy-focal-123
        /^focal-.*-test-\d{10,}$/,           // focal-anything-test-[long-number]
      ];
      
      // Check if name matches any test pattern
      const matchesTestPattern = focalDeployTestPatterns.some(pattern => pattern.test(name));
      
      if (matchesTestPattern) {
        return true;
      }
      
      // Additional checks for repositories with focal-deploy metadata
      const hasMetadataIndicators = [
        // Description patterns (only for auto-generated repos)
        description.includes('focal-deploy') && description.includes('auto'),
        description.includes('created by focal-deploy'),
        description.includes('generated by focal'),
        
        // Topic patterns
        topics.includes('focal-deploy') && topics.includes('auto-created'),
        topics.includes('deployment-test'),
        topics.includes('focal-test')
      ];
      
      // Only include if it has metadata indicators AND doesn't look like a real project
      const hasMetadata = hasMetadataIndicators.some(indicator => indicator);
      const looksLikeRealProject = this.isRealProject(repo);
      
      return hasMetadata && !looksLikeRealProject;
    });
  }
  
  /**
   * Determine if a repository looks like a real project (not a test)
   */
  isRealProject(repo) {
    const name = repo.name.toLowerCase();
    const description = (repo.description || '').toLowerCase();
    
    // Indicators that this is a real project
    const realProjectIndicators = [
      // Has a meaningful description that doesn't mention testing
      description.length > 50 && !description.includes('test') && !description.includes('auto'),
      
      // Has a README or documentation
      repo.has_wiki || repo.has_pages,
      
      // Has significant activity (stars, forks, watchers)
      repo.stargazers_count > 0 || repo.forks_count > 0 || repo.watchers_count > 1,
      
      // Name suggests it's a real project (contains meaningful words, not just timestamps)
      name.includes('tool') || name.includes('app') || name.includes('service') || 
      name.includes('api') || name.includes('lib') || name.includes('framework'),
      
      // Has a license
      repo.license !== null,
      
      // Repository is older than 30 days and has commits
      repo.created_at && new Date() - new Date(repo.created_at) > 30 * 24 * 60 * 60 * 1000,
      
      // Has multiple contributors or branches
      repo.open_issues_count > 0
    ];
    
    // If it has 2 or more indicators, consider it a real project
    return realProjectIndicators.filter(Boolean).length >= 2;
  }

  /**
   * Clean up tracking files
   */
  async cleanupTrackingFiles() {
    try {
      const filesToRemove = [
        this.repoTrackingFile,
        this.globalRepoTrackingFile
      ];
      
      for (const file of filesToRemove) {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
          Logger.info(`Removed tracking file: ${path.relative(this.projectRoot, file)}`);
        }
      }
      
    } catch (error) {
      Logger.error(`Failed to cleanup tracking files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats() {
    const localRepos = await this.getTrackedRepositories();
    const globalRepos = await this.getGlobalTrackedRepositories();
    
    return {
      localCount: Object.keys(localRepos).length,
      globalCount: Object.keys(globalRepos).length,
      localRepositories: Object.keys(localRepos),
      globalRepositories: Object.keys(globalRepos)
    };
  }

  /**
   * Validate tracked repositories (check if they still exist)
   */
  async validateTrackedRepositories(octokit) {
    const trackedRepos = await this.getTrackedRepositories();
    const validRepos = {};
    const invalidRepos = [];
    
    for (const [name, repoData] of Object.entries(trackedRepos)) {
      try {
        await octokit.rest.repos.get({
          owner: repoData.fullName.split('/')[0],
          repo: name
        });
        validRepos[name] = repoData;
      } catch (error) {
        if (error.status === 404) {
          invalidRepos.push(name);
          Logger.warning(`Repository ${name} no longer exists on GitHub`);
        } else {
          // Keep it in case it's a temporary error
          validRepos[name] = repoData;
        }
      }
    }
    
    // Update tracking file with only valid repositories
    if (invalidRepos.length > 0) {
      await fs.writeJson(this.repoTrackingFile, validRepos, { spaces: 2 });
      Logger.info(`Removed ${invalidRepos.length} invalid repositories from tracking`);
    }
    
    return {
      valid: Object.keys(validRepos),
      invalid: invalidRepos
    };
  }
}

module.exports = { GitHubRepoTracker };