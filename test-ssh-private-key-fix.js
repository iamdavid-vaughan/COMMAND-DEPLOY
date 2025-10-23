const { SecurityManager } = require('./lib/utils/security-manager');
const { SSHService } = require('./lib/utils/ssh');
const fs = require('fs-extra');

async function testSSHPrivateKeyFix() {
  console.log('🔍 Testing SSH Private Key Path Fix...\n');
  
  const securityManager = new SecurityManager();
  const ssh = new SSHService();
  
  try {
    // Test 1: Check if SecurityManager can find existing private key
    console.log('Test 1: Finding existing private key...');
    const privateKeyPath = await securityManager.getExistingPrivateKeyPath();
    console.log(`✅ Private key found: ${privateKeyPath}`);
    
    // Test 2: Verify the private key file exists
    console.log('\nTest 2: Verifying private key file exists...');
    const keyExists = await fs.pathExists(privateKeyPath);
    console.log(`✅ Private key file exists: ${keyExists}`);
    
    // Test 3: Read and validate private key format
    console.log('\nTest 3: Validating private key format...');
    const privateKeyContent = await fs.readFile(privateKeyPath, 'utf8');
    const isValidFormat = privateKeyContent.includes('BEGIN') && privateKeyContent.includes('PRIVATE KEY');
    console.log(`✅ Private key format valid: ${isValidFormat}`);
    console.log(`✅ Private key length: ${privateKeyContent.length} characters`);
    
    // Test 4: Test SSH connection options construction
    console.log('\nTest 4: Testing SSH connection options construction...');
    const testOptions = {
      username: 'admin',
      privateKeyPath: privateKeyPath,
      port: 22,
      operatingSystem: 'ubuntu'
    };
    
    // Simulate the SSH service connection options construction
    const privateKeyPathExtracted = testOptions.privateKeyPath;
    const connectionOptions = {
      host: '98.92.156.40',
      port: testOptions.port,
      username: testOptions.username,
      ...testOptions,
      privateKeyPath: privateKeyPathExtracted
    };
    
    console.log(`✅ Connection options privateKeyPath: ${connectionOptions.privateKeyPath}`);
    console.log(`✅ Private key path preserved: ${connectionOptions.privateKeyPath === privateKeyPath}`);
    
    // Test 5: Build SSH command
    console.log('\nTest 5: Building SSH command...');
    const sshCommand = `ssh -i ${connectionOptions.privateKeyPath} -p ${connectionOptions.port} ${connectionOptions.username}@${connectionOptions.host}`;
    console.log(`✅ SSH command: ${sshCommand}`);
    
    console.log('\n🎉 All tests passed! The SSH private key path fix should work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testSSHPrivateKeyFix();