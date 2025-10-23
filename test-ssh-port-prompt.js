#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');

async function testSSHPortPrompt() {
  console.log(chalk.cyan('🔒 Testing SSH Port Prompt Enhancement'));
  console.log(chalk.gray('This demonstrates the improved SSH port prompt with clear default indication\n'));

  const questions = [
    {
      type: 'input',
      name: 'sshPort',
      message: 'Enter custom SSH port (1024-65535) [default: 2847]:',
      default: '2847',
      validate: (input) => {
        const port = parseInt(input);
        
        if (isNaN(port)) {
          return 'Port must be a valid number';
        }
        
        if (port === 22) {
          return 'Port 22 is not allowed for security reasons. Please choose a different port.';
        }
        
        if (port < 1024 || port > 65535) {
          return 'Port must be between 1024 and 65535 (avoiding system ports)';
        }
        
        // Common service ports that should be avoided
        const reservedPorts = [
          80, 443, 21, 22, 23, 25, 53, 67, 68, 69, 110, 123, 143, 161, 162, 179, 389, 443, 465, 514, 587, 636, 993, 995,
          1433, 1521, 3306, 3389, 5432, 5984, 6379, 8080, 8443, 9200, 9300, 11211, 27017, 27018, 27019, 28017
        ];
        
        if (reservedPorts.includes(port)) {
          return `Port ${port} is commonly used by other services. Please choose a different port to avoid conflicts.`;
        }
        
        return true;
      }
    }
  ];

  try {
    const answers = await inquirer.prompt(questions);
    
    console.log('\n✅ SSH Port Configuration:');
    console.log(chalk.green(`   Selected port: ${answers.sshPort}`));
    
    if (answers.sshPort === '2847') {
      console.log(chalk.gray('   Using default port (user pressed Enter)'));
    } else {
      console.log(chalk.yellow('   Using custom port (user specified)'));
    }
    
    console.log('\n📝 Example SSH connection command:');
    console.log(chalk.cyan(`   ssh -i "path/to/key" -p ${answers.sshPort} username@server-ip`));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSSHPortPrompt();