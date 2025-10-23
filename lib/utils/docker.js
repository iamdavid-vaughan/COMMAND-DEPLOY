const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { logger } = require('./logger');
const chalk = require('chalk');

class DockerService {
  constructor() {
    this.dockerAvailable = null;
  }

  async checkDockerAvailability() {
    if (this.dockerAvailable !== null) {
      return this.dockerAvailable;
    }

    try {
      await this.executeCommand('docker', ['--version']);
      this.dockerAvailable = true;
      logger.info(chalk.green('✅ Docker is available'));
      return true;
    } catch (error) {
      this.dockerAvailable = false;
      logger.error(chalk.red('❌ Docker is not available. Please install Docker to use container features.'));
      return false;
    }
  }

  async detectDockerfile(projectPath) {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    const dockerfileExists = await fs.pathExists(dockerfilePath);
    
    if (dockerfileExists) {
      logger.info(chalk.green(`✅ Dockerfile found at: ${dockerfilePath}`));
      return dockerfilePath;
    }
    
    logger.info(chalk.yellow('⚠️  No Dockerfile found in project directory'));
    return null;
  }

  async buildImage(dockerfilePath, imageName, tag = 'latest', dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would build Docker image: ${imageName}:${tag}`));
      logger.info(chalk.cyan(`[DRY RUN] Using Dockerfile: ${dockerfilePath}`));
      return {
        success: true,
        imageId: 'sha256:dry-run-image-id',
        imageName: `${imageName}:${tag}`
      };
    }

    const dockerAvailable = await this.checkDockerAvailability();
    if (!dockerAvailable) {
      throw new Error('Docker is not available');
    }

    const projectPath = path.dirname(dockerfilePath);
    const fullImageName = `${imageName}:${tag}`;

    logger.info(chalk.blue(`🔨 Building Docker image: ${fullImageName}`));
    
    try {
      const result = await this.executeCommand('docker', [
        'build',
        '-t', fullImageName,
        '-f', dockerfilePath,
        projectPath
      ], { cwd: projectPath });

      logger.success(chalk.green(`✅ Docker image built successfully: ${fullImageName}`));
      
      // Get image ID
      const inspectResult = await this.executeCommand('docker', [
        'inspect', '--format={{.Id}}', fullImageName
      ]);
      
      return {
        success: true,
        imageId: inspectResult.stdout.trim(),
        imageName: fullImageName
      };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to build Docker image: ${error.message}`));
      throw error;
    }
  }

  async tagImage(sourceImage, targetImage, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would tag image: ${sourceImage} -> ${targetImage}`));
      return { success: true };
    }

    const dockerAvailable = await this.checkDockerAvailability();
    if (!dockerAvailable) {
      throw new Error('Docker is not available');
    }

    try {
      await this.executeCommand('docker', ['tag', sourceImage, targetImage]);
      logger.success(chalk.green(`✅ Image tagged: ${sourceImage} -> ${targetImage}`));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to tag image: ${error.message}`));
      throw error;
    }
  }

  async pushImage(imageName, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would push image: ${imageName}`));
      return { success: true };
    }

    const dockerAvailable = await this.checkDockerAvailability();
    if (!dockerAvailable) {
      throw new Error('Docker is not available');
    }

    logger.info(chalk.blue(`📤 Pushing Docker image: ${imageName}`));
    
    try {
      await this.executeCommand('docker', ['push', imageName]);
      logger.success(chalk.green(`✅ Image pushed successfully: ${imageName}`));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to push image: ${error.message}`));
      throw error;
    }
  }

  async loginToECR(authToken, registryUrl, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would login to ECR: ${registryUrl}`));
      return { success: true };
    }

    const dockerAvailable = await this.checkDockerAvailability();
    if (!dockerAvailable) {
      throw new Error('Docker is not available');
    }

    try {
      // Decode the auth token (it's base64 encoded)
      const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
      const [username, password] = decodedToken.split(':');

      await this.executeCommand('docker', [
        'login',
        '--username', username,
        '--password-stdin',
        registryUrl
      ], { input: password });

      logger.success(chalk.green(`✅ Successfully logged in to ECR: ${registryUrl}`));
      return { success: true };
    } catch (error) {
      logger.error(chalk.red(`❌ Failed to login to ECR: ${error.message}`));
      throw error;
    }
  }

  async removeImage(imageName, dryRun = false) {
    if (dryRun) {
      logger.info(chalk.cyan(`[DRY RUN] Would remove image: ${imageName}`));
      return { success: true };
    }

    const dockerAvailable = await this.checkDockerAvailability();
    if (!dockerAvailable) {
      return { success: true }; // Skip if Docker not available
    }

    try {
      await this.executeCommand('docker', ['rmi', imageName]);
      logger.info(chalk.green(`✅ Image removed: ${imageName}`));
      return { success: true };
    } catch (error) {
      // Don't throw error if image doesn't exist
      logger.info(chalk.yellow(`⚠️  Image not found or already removed: ${imageName}`));
      return { success: true };
    }
  }

  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
        cwd: options.cwd || process.cwd()
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      if (options.input && child.stdin) {
        child.stdin.write(options.input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateImageName(projectName, region) {
    // Generate ECR-compatible image name
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `focal-deploy-${sanitizedName}`;
  }

  generateECRUri(registryId, region, repositoryName) {
    return `${registryId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}`;
  }
}

module.exports = { DockerService };