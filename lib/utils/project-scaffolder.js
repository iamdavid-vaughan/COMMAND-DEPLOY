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

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { Logger } = require('./logger');

class ProjectScaffolder {
  constructor() {
    this.logger = Logger;
  }

  async createProjectStructure(targetPath, projectName) {
    try {
      this.logger.info(`📁 Creating project structure for ${chalk.cyan(projectName)}...`);

      // Ensure target directory exists
      await fs.ensureDir(targetPath);

      // Create main directories
      const directories = [
        'src',
        'src/routes',
        'src/public',
        'tests',
        'deploy',
        '.github',
        '.github/workflows'
      ];

      for (const dir of directories) {
        const dirPath = path.join(targetPath, dir);
        await fs.ensureDir(dirPath);
        // Directory created successfully
      }

      this.logger.success(`✅ Project structure created successfully`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to create project structure: ${error.message}`);
      throw error;
    }
  }

  async validateWritePermissions(targetPath) {
    try {
      // Test write permissions by creating a temporary file
      const testFile = path.join(targetPath, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      return true;
    } catch (error) {
      throw new Error(`No write permissions for directory: ${targetPath}`);
    }
  }

  async checkDirectoryEmpty(targetPath) {
    try {
      const exists = await fs.pathExists(targetPath);
      if (!exists) return true;

      const files = await fs.readdir(targetPath);
      return files.length === 0;
    } catch (error) {
      return false;
    }
  }

  async getDirectoryInfo(targetPath) {
    try {
      const exists = await fs.pathExists(targetPath);
      if (!exists) {
        return {
          exists: false,
          isEmpty: true,
          writable: false
        };
      }

      const files = await fs.readdir(targetPath);
      const isEmpty = files.length === 0;
      
      let writable = false;
      try {
        await this.validateWritePermissions(targetPath);
        writable = true;
      } catch (error) {
        // Write permissions check failed
      }

      return {
        exists: true,
        isEmpty,
        writable,
        fileCount: files.length
      };

    } catch (error) {
      return {
        exists: false,
        isEmpty: true,
        writable: false,
        error: error.message
      };
    }
  }
}

module.exports = { ProjectScaffolder };