/**
 * Enhanced EC2 Deployment Service - Complete deployment with SSH keypair
 */

const {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  AllocateAddressCommand,
  AssociateAddressCommand,
  CreateKeyPairCommand,
  DeleteKeyPairCommand,
  CreateTagsCommand,
} = require('@aws-sdk/client-ec2');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

/**
 * Create EC2 deployment with SSH keypair
 */
async function createDeploymentWithSSH(awsCredentials, deploymentConfig) {
  const {
    region = 'us-east-1',
    instanceType = 't3.micro',
    projectName,
    configuration = {},
  } = deploymentConfig;

  const { accessKeyId, secretAccessKey } = awsCredentials;
  const { server = {}, security = {} } = configuration;

  // Create EC2 client
  const ec2Client = new EC2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    console.log(`🚀 [EC2] Starting deployment for project: ${projectName}`);

    // Step 1: Verify credentials
    const accountId = await verifyCredentials(accessKeyId, secretAccessKey, region);
    console.log(`✅ [EC2] Verified AWS credentials for account: ${accountId}`);

    // Step 2: Create SSH keypair
    const keyPairName = `focal-deploy-${projectName}-${Date.now()}`;
    const keypair = await createKeyPair(ec2Client, keyPairName);
    console.log(`✅ [EC2] SSH keypair created: ${keyPairName}`);

    // Step 3: Create security group with custom ports
    const sshPort = server.sshPort || 22;
    const appPort = configuration.application?.port || 3000;
    const allowedPorts = security.allowedPorts || [sshPort, 80, 443, appPort];

    const securityGroupId = await createSecurityGroupWithPorts(
      ec2Client,
      projectName,
      allowedPorts
    );
    console.log(`✅ [EC2] Security group created: ${securityGroupId}`);

    // Step 4: Get AMI based on OS selection
    const os = server.os || 'ubuntu-22.04';
    const amiId = getAMIForOS(region, os);
    console.log(`✅ [EC2] Using AMI: ${amiId} (${os})`);

    // Step 5: Launch EC2 instance
    const instanceId = await launchInstanceWithKey(ec2Client, {
      amiId,
      instanceType,
      securityGroupId,
      keyPairName,
      projectName,
    });
    console.log(`✅ [EC2] Instance launched: ${instanceId}`);

    // Step 6: Wait for instance to be running
    const instance = await waitForInstanceRunning(ec2Client, instanceId);
    console.log(`✅ [EC2] Instance running with private IP: ${instance.privateIp}`);

    // Step 7: Allocate and associate Elastic IP
    const publicIp = await allocateAndAssociateElasticIP(ec2Client, instanceId);
    console.log(`✅ [EC2] Elastic IP allocated: ${publicIp}`);

    return {
      success: true,
      instanceId,
      publicIp,
      privateIp: instance.privateIp,
      securityGroupId,
      keyPairName,
      privateKey: keypair.privateKey,
      region,
      username: getDefaultUsername(os),
    };
  } catch (error) {
    console.error(`❌ [EC2] Deployment failed:`, error);
    throw new Error(`EC2 deployment failed: ${error.message}`);
  }
}

/**
 * Verify AWS credentials using STS
 */
async function verifyCredentials(accessKeyId, secretAccessKey, region) {
  const stsClient = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new GetCallerIdentityCommand({});
  const response = await stsClient.send(command);
  return response.Account;
}

/**
 * Create SSH keypair
 */
async function createKeyPair(ec2Client, keyPairName) {
  const command = new CreateKeyPairCommand({
    KeyName: keyPairName,
    TagSpecifications: [
      {
        ResourceType: 'key-pair',
        Tags: [
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'CreatedAt', Value: new Date().toISOString() },
        ],
      },
    ],
  });

  const response = await ec2Client.send(command);
  return {
    keyPairName: response.KeyName,
    privateKey: response.KeyMaterial,
    fingerprint: response.KeyFingerprint,
  };
}

/**
 * Create security group with custom ports
 */
async function createSecurityGroupWithPorts(ec2Client, projectName, allowedPorts) {
  const groupName = `focal-deploy-${projectName}-${Date.now()}`;
  const description = `Security group for Focal Deploy project: ${projectName}`;

  // Create security group
  const createCommand = new CreateSecurityGroupCommand({
    GroupName: groupName,
    Description: description,
  });

  const createResponse = await ec2Client.send(createCommand);
  const groupId = createResponse.GroupId;

  // Create ingress rules for all allowed ports
  const ipPermissions = allowedPorts.map((port) => ({
    IpProtocol: 'tcp',
    FromPort: port,
    ToPort: port,
    IpRanges: [{ CidrIp: '0.0.0.0/0' }],
  }));

  const authorizeCommand = new AuthorizeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: ipPermissions,
  });

  await ec2Client.send(authorizeCommand);

  return groupId;
}

/**
 * Launch EC2 instance with SSH keypair
 */
async function launchInstanceWithKey(ec2Client, config) {
  const { amiId, instanceType, securityGroupId, keyPairName, projectName } = config;

  const command = new RunInstancesCommand({
    ImageId: amiId,
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: keyPairName,
    SecurityGroupIds: [securityGroupId],
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: `focal-deploy-${projectName}` },
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'Project', Value: projectName },
        ],
      },
    ],
  });

  const response = await ec2Client.send(command);
  return response.Instances[0].InstanceId;
}

/**
 * Wait for instance to be running
 */
async function waitForInstanceRunning(ec2Client, instanceId, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    });

    const response = await ec2Client.send(command);
    const instance = response.Reservations?.[0]?.Instances?.[0];

    if (!instance) {
      throw new Error('Instance not found');
    }

    const state = instance.State.Name;

    if (state === 'running') {
      return {
        state,
        privateIp: instance.PrivateIpAddress,
        publicIp: instance.PublicIpAddress,
      };
    }

    if (state === 'terminated' || state === 'stopping' || state === 'stopped') {
      throw new Error(`Instance entered unexpected state: ${state}`);
    }

    // Wait 10 seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error('Timeout waiting for instance to be running');
}

/**
 * Allocate and associate Elastic IP
 */
async function allocateAndAssociateElasticIP(ec2Client, instanceId) {
  // Allocate Elastic IP
  const allocateCommand = new AllocateAddressCommand({
    Domain: 'vpc',
    TagSpecifications: [
      {
        ResourceType: 'elastic-ip',
        Tags: [
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'InstanceId', Value: instanceId },
        ],
      },
    ],
  });

  const allocateResponse = await ec2Client.send(allocateCommand);
  const allocationId = allocateResponse.AllocationId;
  const publicIp = allocateResponse.PublicIp;

  // Associate with instance
  const associateCommand = new AssociateAddressCommand({
    AllocationId: allocationId,
    InstanceId: instanceId,
  });

  await ec2Client.send(associateCommand);

  return publicIp;
}

/**
 * Get AMI ID based on OS and region
 */
function getAMIForOS(region, os) {
  // Ubuntu 22.04 LTS AMIs
  const ubuntu2204 = {
    'us-east-1': 'ami-0261755bbcb8c4a84',
    'us-east-2': 'ami-0430580de6244e02e',
    'us-west-1': 'ami-04d1dcfb793f6fa37',
    'us-west-2': 'ami-0c65adc9a5c1b5d7c',
    'eu-west-1': 'ami-0905a3c97561e0b69',
    'eu-central-1': 'ami-0faab6bdbac9486fb',
    'ap-southeast-1': 'ami-0dc2d3e4c0f9ebd18',
    'ap-northeast-1': 'ami-03f4fa076d2981b45',
  };

  // Ubuntu 20.04 LTS AMIs
  const ubuntu2004 = {
    'us-east-1': 'ami-0557a15b87f6559cf',
    'us-east-2': 'ami-00eeedc4036573771',
    'us-west-1': 'ami-0d5075a8c1e9e951',
    'us-west-2': 'ami-03bc6762070a243d8',
    'eu-west-1': 'ami-0694d931cee176e7d',
    'eu-central-1': 'ami-0502e817a62226e03',
    'ap-southeast-1': 'ami-0c802847a7dd848c0',
    'ap-northeast-1': 'ami-03f4fa076d2981b45',
  };

  // Amazon Linux 2 AMIs
  const amazonLinux2 = {
    'us-east-1': 'ami-0c55b159cbfafe1f0',
    'us-east-2': 'ami-0d5d9d301c853a04a',
    'us-west-1': 'ami-04e59c05167ea7bd5',
    'us-west-2': 'ami-0b152cfd354c4c7a4',
    'eu-west-1': 'ami-0ea3405d2d2522162',
    'eu-central-1': 'ami-0c960b947cbb2dd16',
    'ap-southeast-1': 'ami-0c802847a7dd848c0',
    'ap-northeast-1': 'ami-00d101850e971728d',
  };

  let amiMap;
  if (os === 'ubuntu-22.04') {
    amiMap = ubuntu2204;
  } else if (os === 'ubuntu-20.04') {
    amiMap = ubuntu2004;
  } else if (os === 'amazon-linux-2') {
    amiMap = amazonLinux2;
  } else {
    // Default to Ubuntu 22.04
    amiMap = ubuntu2204;
  }

  return amiMap[region] || amiMap['us-east-1'];
}

/**
 * Get default username for OS
 */
function getDefaultUsername(os) {
  if (os.startsWith('ubuntu')) {
    return 'ubuntu';
  } else if (os === 'amazon-linux-2') {
    return 'ec2-user';
  }
  return 'ubuntu'; // Default
}

/**
 * Terminate deployment and clean up resources
 */
async function terminateDeploymentComplete(awsCredentials, deploymentInfo) {
  const { region, instanceId, keyPairName } = deploymentInfo;
  const { accessKeyId, secretAccessKey } = awsCredentials;

  const ec2Client = new EC2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Terminate instance
  const terminateCommand = new TerminateInstancesCommand({
    InstanceIds: [instanceId],
  });
  await ec2Client.send(terminateCommand);

  // Delete keypair if provided
  if (keyPairName) {
    try {
      const deleteKeyCommand = new DeleteKeyPairCommand({
        KeyName: keyPairName,
      });
      await ec2Client.send(deleteKeyCommand);
    } catch (error) {
      console.warn(`⚠️  [EC2] Could not delete keypair ${keyPairName}:`, error.message);
    }
  }

  return { success: true };
}

module.exports = {
  createDeploymentWithSSH,
  terminateDeploymentComplete,
  getAMIForOS,
  getDefaultUsername,
};
