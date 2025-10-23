const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Comprehensive deployment logger for debugging and audit trails
 */
class DeploymentLogger {
  constructor(instanceId = 'unknown') {
    this.instanceId = instanceId;
    this.logDir = path.join(process.cwd(), '.focal-deploy', 'logs');
    this.logFile = path.join(this.logDir, `deployment-${instanceId}-${Date.now()}.log`);
    this.sshLogFile = path.join(this.logDir, `ssh-${instanceId}-${Date.now()}.log`);
    this.securityLogFile = path.join(this.logDir, `security-${instanceId}-${Date.now()}.log`);
    
    // Ensure log directory exists
    fs.ensureDirSync(this.logDir);
    
    // Initialize log files
    this.writeToFile(this.logFile, `=== DEPLOYMENT LOG STARTED ===\nInstance ID: ${instanceId}\nTimestamp: ${new Date().toISOString()}\n\n`);
    this.writeToFile(this.sshLogFile, `=== SSH LOG STARTED ===\nInstance ID: ${instanceId}\nTimestamp: ${new Date().toISOString()}\n\n`);
    this.writeToFile(this.securityLogFile, `=== SECURITY LOG STARTED ===\nInstance ID: ${instanceId}\nTimestamp: ${new Date().toISOString()}\n\n`);
  }

  writeToFile(filePath, content) {
    try {
      // Ensure the directory exists
      const logDir = path.dirname(filePath);
      fs.ensureDirSync(logDir);
      
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${content}\n`;
      fs.appendFileSync(filePath, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error.message);
    }
  }

  logDeploymentStep(step, details = '') {
    const message = `DEPLOYMENT STEP: ${step} ${details}`;
    console.log(chalk.blue(message));
    this.writeToFile(this.logFile, message);
  }

  logSSHConnection(host, port, username, status, details = '') {
    const message = `SSH CONNECTION: ${username}@${host}:${port} - ${status} ${details}`;
    console.log(chalk.cyan(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHCommand(command, result, error = null) {
    const message = `SSH COMMAND: ${command}\nRESULT: ${result}\n${error ? `ERROR: ${error}` : ''}`;
    console.log(chalk.gray(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHCommandExecution(command, host, port, username) {
    const sshCommand = `ssh -p ${port} ${username}@${host} "${command}"`;
    const message = `EXECUTING SSH COMMAND: ${sshCommand}`;
    console.log(chalk.cyan(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHCommandResult(command, exitCode, stdout, stderr, duration) {
    const message = `SSH COMMAND RESULT:
  Command: ${command}
  Exit Code: ${exitCode}
  Duration: ${duration}ms
  STDOUT: ${stdout || '(empty)'}
  STDERR: ${stderr || '(empty)'}`;
    console.log(chalk.gray(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHConnectionAttempt(host, port, username, privateKeyPath, attempt, maxAttempts) {
    const sshCommand = `ssh -i ${privateKeyPath || '~/.ssh/id_rsa'} -p ${port} ${username}@${host}`;
    const message = `SSH CONNECTION ATTEMPT ${attempt}/${maxAttempts}:
  Equivalent Command: ${sshCommand}
  Host: ${host}
  Port: ${port}
  Username: ${username}
  Private Key: ${privateKeyPath || 'Not provided'}`;
    console.log(chalk.yellow(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHConnectionSuccess(host, port, username, duration) {
    const message = `SSH CONNECTION SUCCESS: ${username}@${host}:${port} (${duration}ms)`;
    console.log(chalk.green(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHConnectionFailure(host, port, username, error, attempt, maxAttempts) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] SSH CONNECTION FAILED: ${username}@${host}:${port} (attempt ${attempt}/${maxAttempts})
  Error: ${error.message}
  Error Code: ${error.code || 'unknown'}
  Error Level: ${error.level || 'unknown'}`;
    console.error(chalk.red(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSSHAuthenticationFlow(host, port, username, authMethods, privateKeyPresent) {
    const message = `SSH AUTHENTICATION FLOW: ${username}@${host}:${port}
  Available Auth Methods: ${authMethods ? authMethods.join(', ') : 'unknown'}
  Private Key Present: ${privateKeyPresent}
  Authentication Type: ${privateKeyPresent ? 'Public Key' : 'Password/Keyboard Interactive'}`;
    console.log(chalk.blue(message));
    this.writeToFile(this.sshLogFile, message);
  }

  logSecurityAction(action, details = '') {
    const message = `SECURITY ACTION: ${action} ${details}`;
    console.log(chalk.yellow(message));
    this.writeToFile(this.securityLogFile, message);
  }

  logSecurityGroupChange(securityGroupId, action, port, status) {
    const message = `SECURITY GROUP: ${securityGroupId} - ${action} port ${port} - ${status}`;
    console.log(chalk.magenta(message));
    this.writeToFile(this.securityLogFile, message);
  }

  logFirewallChange(action, port, status, details = '') {
    const message = `FIREWALL: ${action} port ${port} - ${status} ${details}`;
    console.log(chalk.red(message));
    this.writeToFile(this.securityLogFile, message);
  }

  logPhase(phaseNumber, phaseName, status = 'STARTED') {
    const message = `=== PHASE ${phaseNumber}: ${phaseName} - ${status} ===`;
    console.log(chalk.bold.cyan(message));
    this.writeToFile(this.logFile, message);
    this.writeToFile(this.securityLogFile, message);
  }

  logError(error, context = '') {
    const message = `ERROR ${context}: ${error.message}\nSTACK: ${error.stack}`;
    console.error(chalk.red(message));
    this.writeToFile(this.logFile, message);
    this.writeToFile(this.sshLogFile, message);
    this.writeToFile(this.securityLogFile, message);
  }

  logSuccess(message, context = '') {
    const fullMessage = `SUCCESS ${context}: ${message}`;
    console.log(chalk.green(fullMessage));
    this.writeToFile(this.logFile, fullMessage);
  }

  logWarning(message, context = '') {
    const fullMessage = `WARNING ${context}: ${message}`;
    console.warn(chalk.yellow(fullMessage));
    this.writeToFile(this.logFile, fullMessage);
  }

  logPhase(phaseNumber, phaseName, status = 'STARTED') {
    const message = `=== PHASE ${phaseNumber}: ${phaseName} - ${status} ===`;
    console.log(chalk.bold.cyan(message));
    this.writeToFile(this.logFile, message);
    this.writeToFile(this.securityLogFile, message);
  }

  getLogFiles() {
    return {
      deployment: this.logFile,
      ssh: this.sshLogFile,
      security: this.securityLogFile
    };
  }

  // Static method to create logger instance
  static create(instanceId) {
    return new DeploymentLogger(instanceId);
  }
}

module.exports = { DeploymentLogger };