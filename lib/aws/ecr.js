const { ECRClient, CreateRepositoryCommand, GetAuthorizationTokenCommand, DescribeRepositoriesCommand } = require('@aws-sdk/client-ecr');
const { logger } = require('../utils/logger');
const chalk = require('chalk');

class ECRService {
  constructor(credentials, region) {
    this.client = new ECRClient({
      credentials,
      region
    });
    this.region = region;
  }

  async createRepository(repositoryName, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would create ECR repository: ${repositoryName}`));
      return {
        repository: {
          repositoryName,
          repositoryUri: `123456789012.dkr.ecr.${this.region}.amazonaws.com/${repositoryName}`,
          registryId: '123456789012'
        }
      };
    }

    try {
      // Check if repository already exists
      try {
        const describeCommand = new DescribeRepositoriesCommand({
          repositoryNames: [repositoryName]
        });
        const existing = await this.client.send(describeCommand);
        
        if (existing.repositories && existing.repositories.length > 0) {
          logger.info(chalk.yellow(`ECR repository ${repositoryName} already exists, using existing repository`));
          return { repository: existing.repositories[0] };
        }
      } catch (error) {
        // Repository doesn't exist, continue with creation
        if (error.name !== 'RepositoryNotFoundException') {
          throw error;
        }
      }

      const command = new CreateRepositoryCommand({
        repositoryName,
        imageScanningConfiguration: {
          scanOnPush: true
        },
        encryptionConfiguration: {
          encryptionType: 'AES256'
        }
      });

      const result = await this.client.send(command);
      logger.success(chalk.green(`✅ ECR repository created: ${repositoryName}`));
      
      return result;
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to create ECR repository: ${error.message}`));
      throw error;
    }
  }

  async getAuthorizationToken(dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would get ECR authorization token`));
      return {
        authorizationData: [{
          authorizationToken: 'ZHJ5LXJ1bi10b2tlbg==', // base64 encoded "dry-run-token"
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
          proxyEndpoint: `https://123456789012.dkr.ecr.${this.region}.amazonaws.com`
        }]
      };
    }

    try {
      const command = new GetAuthorizationTokenCommand({});
      const result = await this.client.send(command);
      
      logger.info(chalk.green('✅ ECR authorization token retrieved'));
      return result;
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to get ECR authorization token: ${error.message}`));
      throw error;
    }
  }

  async listRepositories(dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would list ECR repositories`));
      return {
        repositories: [
          {
            repositoryName: 'focal-deploy-test-app',
            repositoryUri: `123456789012.dkr.ecr.${this.region}.amazonaws.com/focal-deploy-test-app`,
            registryId: '123456789012'
          }
        ]
      };
    }

    try {
      const command = new DescribeRepositoriesCommand({});
      const result = await this.client.send(command);
      
      return result;
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to list ECR repositories: ${error.message}`));
      throw error;
    }
  }

  async deleteRepository(repositoryName, force = false, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would delete ECR repository: ${repositoryName}`));
      return { repository: { repositoryName } };
    }

    try {
      const { DeleteRepositoryCommand } = require('@aws-sdk/client-ecr');
      const command = new DeleteRepositoryCommand({
        repositoryName,
        force // Delete even if repository contains images
      });

      const result = await this.client.send(command);
      logger.success(chalk.green(`✅ ECR repository deleted: ${repositoryName}`));
      
      return result;
    } catch (error) {
      if (error.name === 'RepositoryNotFoundException') {
        logger.info(chalk.yellow(`ECR repository ${repositoryName} not found, skipping deletion`));
        return null;
      }
      
      logger.error(chalk.red(`❌ Failed to delete ECR repository: ${error.message}`));
      throw error;
    }
  }
}

module.exports = { ECRService };