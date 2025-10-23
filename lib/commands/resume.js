const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { Logger } = require('../utils/logger');
const { WizardManager } = require('../wizard/wizard-manager');

class ResumeCommand {
  constructor() {
    this.logger = Logger;
  }

  async execute(options = {}) {
    try {
      const currentDir = process.cwd();
      
      // Check if we're in a focal-deploy project directory
      const wizardDir = path.join(currentDir, '.focal-deploy', 'wizard');
      
      if (!await fs.pathExists(wizardDir)) {
        this.logger.error('❌ No focal-deploy project found in current directory');
        this.logger.info('💡 Make sure you are in a directory that contains a .focal-deploy folder');
        this.logger.info('💡 Or use "focal-deploy new <project-name>" to create a new project');
        process.exit(1);
      }

      // Find existing wizard session files
      const sessionFiles = await fs.readdir(wizardDir);
      const jsonFiles = sessionFiles.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        this.logger.error('❌ No wizard sessions found to resume');
        this.logger.info('💡 Use "focal-deploy new <project-name>" to start a new setup');
        process.exit(1);
      }

      // Use the most recent session file
      const sessionFile = jsonFiles[jsonFiles.length - 1];
      const sessionId = path.basename(sessionFile, '.json');
      
      this.logger.info(`🔄 Found wizard session: ${chalk.cyan(sessionId.substring(0, 8))}...`);
      
      // Load the wizard state to get project info
      const sessionPath = path.join(wizardDir, sessionFile);
      const wizardState = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
      
      this.logger.info(`📋 Resuming project: ${chalk.cyan(wizardState.projectName)}`);
      this.logger.info(`📁 Location: ${chalk.gray(wizardState.projectPath)}`);
      
      // Initialize wizard manager and resume
      const wizard = new WizardManager(wizardState.projectName, wizardState.projectPath, options);
      await wizard.resumeWizard(sessionId);
      
      this.logger.success('✅ Wizard session resumed successfully!');

    } catch (error) {
      this.logger.error(`Failed to resume wizard: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ResumeCommand };