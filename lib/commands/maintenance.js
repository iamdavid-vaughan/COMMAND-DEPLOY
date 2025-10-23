const chalk = require('chalk');
const inquirer = require('inquirer');
const { Logger } = require('../utils/logger');
const { ErrorHandler, FocalDeployError } = require('../utils/errors');
const { StateManager } = require('../utils/state');
const { InstanceTracker } = require('../utils/instance-tracker');
const { GitHubCleanupService } = require('../utils/github-cleanup');
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

class MaintenanceCommand {
  constructor() {
    this.stateManager = new StateManager();
    this.instanceTracker = new InstanceTracker();
    this.githubCleanup = new GitHubCleanupService();
  }

  async execute(options = {}) {
    try {
      Logger.section('🔧 Focal Deploy Maintenance');
      
      if (options.checkOrphans) {
        await this.checkOrphanedResources();
      }
      
      if (options.validateState) {
        await this.validateStateFiles();
      }
      
      if (options.repair) {
        await this.repairInconsistentState();
      }
      
      if (options.cleanupTemp) {
        await this.cleanupTemporaryFiles();
      }
      
      // If no specific options, run interactive maintenance
      if (!options.checkOrphans && !options.validateState && !options.repair && !options.cleanupTemp) {
        await this.runInteractiveMaintenance();
      }
      
      Logger.success('✅ Maintenance operations completed');
      
    } catch (error) {
      ErrorHandler.handle(error);
      throw error;
    }
  }

  async runInteractiveMaintenance() {
    console.log(chalk.blue('🔍 Select maintenance operations to perform:\n'));
    
    const { operations } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'operations',
        message: 'Choose maintenance operations:',
        choices: [
          {
            name: '🔍 Check for orphaned resources',
            value: 'orphans',
            checked: true
          },
          {
            name: '📋 Validate state files',
            value: 'validate',
            checked: true
          },
          {
            name: '🔧 Repair inconsistent state',
            value: 'repair',
            checked: false
          },
          {
            name: '🗑️ Clean up temporary files',
            value: 'cleanup',
            checked: true
          },
          {
            name: '📊 Generate maintenance report',
            value: 'report',
            checked: true
          }
        ]
      }
    ]);

    if (operations.includes('orphans')) {
      await this.checkOrphanedResources();
    }
    
    if (operations.includes('validate')) {
      await this.validateStateFiles();
    }
    
    if (operations.includes('repair')) {
      await this.repairInconsistentState();
    }
    
    if (operations.includes('cleanup')) {
      await this.cleanupTemporaryFiles();
    }
    
    if (operations.includes('report')) {
      await this.generateMaintenanceReport();
    }
  }

  async checkOrphanedResources() {
    Logger.info('🔍 Checking for orphaned resources...');
    
    try {
      // Check for orphaned instance tracking files
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
        
        // Check if state file exists
        if (instanceData.stateFile && !await fs.pathExists(instanceData.stateFile)) {
          orphanedInstances.push({
            id: instanceId,
            reason: 'State file missing',
            data: instanceData
          });
        }
      }
      
      if (orphanedInstances.length > 0) {
        Logger.warning(`Found ${orphanedInstances.length} orphaned instance(s):`);
        orphanedInstances.forEach(orphan => {
          console.log(chalk.yellow(`  • ${orphan.id}: ${orphan.reason}`));
        });
        
        const { shouldCleanup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldCleanup',
            message: 'Clean up orphaned instances?',
            default: true
          }
        ]);
        
        if (shouldCleanup) {
          for (const orphan of orphanedInstances) {
            await this.instanceTracker.destroyInstance(orphan.id);
            Logger.success(`✅ Cleaned up orphaned instance: ${orphan.id}`);
          }
        }
      } else {
        Logger.success('✅ No orphaned resources found');
      }
      
    } catch (error) {
      Logger.error(`Failed to check orphaned resources: ${error.message}`);
    }
  }

  async validateStateFiles() {
    Logger.info('📋 Validating state files...');
    
    try {
      const stateFiles = glob.sync('**/.focal-deploy/state.json', { 
        cwd: process.cwd(),
        absolute: true 
      });
      
      const issues = [];
      
      for (const stateFile of stateFiles) {
        try {
          const state = await fs.readJson(stateFile);
          
          // Validate state structure
          if (!state.resources) {
            issues.push({
              file: stateFile,
              issue: 'Missing resources section',
              severity: 'error'
            });
          }
          
          if (!state.timestamp) {
            issues.push({
              file: stateFile,
              issue: 'Missing timestamp',
              severity: 'warning'
            });
          }
          
          // Validate resource references
          if (state.resources) {
            if (state.resources.ec2Instance && !state.resources.ec2Instance.instanceId) {
              issues.push({
                file: stateFile,
                issue: 'EC2 instance missing instanceId',
                severity: 'error'
              });
            }
            
            if (state.resources.s3Bucket && !state.resources.s3Bucket.name) {
              issues.push({
                file: stateFile,
                issue: 'S3 bucket missing name',
                severity: 'error'
              });
            }
          }
          
        } catch (parseError) {
          issues.push({
            file: stateFile,
            issue: `Invalid JSON: ${parseError.message}`,
            severity: 'error'
          });
        }
      }
      
      if (issues.length > 0) {
        Logger.warning(`Found ${issues.length} state file issue(s):`);
        issues.forEach(issue => {
          const color = issue.severity === 'error' ? chalk.red : chalk.yellow;
          console.log(color(`  • ${path.relative(process.cwd(), issue.file)}: ${issue.issue}`));
        });
      } else {
        Logger.success('✅ All state files are valid');
      }
      
    } catch (error) {
      Logger.error(`Failed to validate state files: ${error.message}`);
    }
  }

  async repairInconsistentState() {
    Logger.info('🔧 Repairing inconsistent state...');
    
    try {
      // This is a placeholder for state repair logic
      // In a real implementation, you would:
      // 1. Check AWS resources against state files
      // 2. Update state files to match actual AWS resources
      // 3. Fix missing or incorrect resource references
      
      Logger.info('State repair functionality is not yet implemented');
      Logger.info('This would check AWS resources against state files and fix inconsistencies');
      
    } catch (error) {
      Logger.error(`Failed to repair state: ${error.message}`);
    }
  }

  async cleanupTemporaryFiles() {
    Logger.info('🗑️ Cleaning up temporary files...');
    
    try {
      const tempPatterns = [
        '**/.focal-deploy/temp/**',
        '**/.focal-deploy/*.tmp',
        '**/.focal-deploy/*.log',
        '**/focal-deploy-*.tmp',
        '**/ssh-test-*.js'
      ];
      
      let cleanedCount = 0;
      
      for (const pattern of tempPatterns) {
        const files = glob.sync(pattern, { 
          cwd: process.cwd(),
          absolute: true 
        });
        
        for (const file of files) {
          try {
            await fs.remove(file);
            cleanedCount++;
            Logger.info(`Removed: ${path.relative(process.cwd(), file)}`);
          } catch (removeError) {
            Logger.warning(`Failed to remove ${file}: ${removeError.message}`);
          }
        }
      }
      
      if (cleanedCount > 0) {
        Logger.success(`✅ Cleaned up ${cleanedCount} temporary file(s)`);
      } else {
        Logger.success('✅ No temporary files to clean up');
      }
      
    } catch (error) {
      Logger.error(`Failed to cleanup temporary files: ${error.message}`);
    }
  }

  async generateMaintenanceReport() {
    Logger.info('📊 Generating maintenance report...');
    
    try {
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalInstances: 0,
          activeDeployments: 0,
          stateFiles: 0,
          tempFiles: 0
        },
        instances: {},
        issues: []
      };
      
      // Count instances
      const instances = await this.instanceTracker.getAllInstances();
      report.summary.totalInstances = Object.keys(instances).length;
      report.instances = instances;
      
      // Count state files
      const stateFiles = glob.sync('**/.focal-deploy/state.json', { 
        cwd: process.cwd() 
      });
      report.summary.stateFiles = stateFiles.length;
      
      // Count active deployments (state files with resources)
      for (const stateFile of stateFiles) {
        try {
          const state = await fs.readJson(path.join(process.cwd(), stateFile));
          if (state.resources && Object.keys(state.resources).length > 0) {
            report.summary.activeDeployments++;
          }
        } catch (error) {
          report.issues.push(`Failed to read state file: ${stateFile}`);
        }
      }
      
      // Count temp files
      const tempFiles = glob.sync('**/.focal-deploy/temp/**', { 
        cwd: process.cwd() 
      });
      report.summary.tempFiles = tempFiles.length;
      
      // Save report
      const reportPath = path.join(process.cwd(), '.focal-deploy', 'maintenance-report.json');
      await fs.ensureDir(path.dirname(reportPath));
      await fs.writeJson(reportPath, report, { spaces: 2 });
      
      Logger.success(`✅ Maintenance report saved to: ${reportPath}`);
      
      // Display summary
      console.log(chalk.blue('\n📊 Maintenance Summary:'));
      console.log(`   Total Instances: ${report.summary.totalInstances}`);
      console.log(`   Active Deployments: ${report.summary.activeDeployments}`);
      console.log(`   State Files: ${report.summary.stateFiles}`);
      console.log(`   Temporary Files: ${report.summary.tempFiles}`);
      
      if (report.issues.length > 0) {
        console.log(chalk.yellow(`   Issues Found: ${report.issues.length}`));
      }
      
    } catch (error) {
      Logger.error(`Failed to generate maintenance report: ${error.message}`);
    }
  }
}

module.exports = { MaintenanceCommand };