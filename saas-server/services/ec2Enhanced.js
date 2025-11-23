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
const {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  AddRoleToInstanceProfileCommand,
  GetInstanceProfileCommand,
  GetRoleCommand,
} = require('@aws-sdk/client-iam');
const logger = require('../utils/logger');

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

  // Create IAM client for SSM role management
  const iamClient = new IAMClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    logger.info('EC2Enhanced: Starting deployment', { projectName, region, instanceType });

    // Step 1: Verify credentials
    const accountId = await verifyCredentials(accessKeyId, secretAccessKey, region);
    logger.info('EC2Enhanced: Verified AWS credentials', { accountId });

    // Step 2: Create SSH keypair
    const keyPairName = `focal-deploy-${projectName}-${Date.now()}`;
    const keypair = await createKeyPair(ec2Client, keyPairName);
    logger.info('EC2Enhanced: SSH keypair created', { keyPairName });

    // Step 3: Create security group with custom ports
    const sshPort = server.sshPort || 22;
    const appPort = configuration.application?.port || 3000;
    const allowedPorts = security.allowedPorts || [sshPort, 80, 443, appPort];

    const securityGroupId = await createSecurityGroupWithPorts(
      ec2Client,
      projectName,
      allowedPorts
    );
    logger.info('EC2Enhanced: Security group created', { securityGroupId, allowedPorts });

    // Step 4: Get AMI based on OS selection
    const os = server.os || 'ubuntu-22.04';
    const amiId = getAMIForOS(region, os);
    logger.info('EC2Enhanced: Using AMI', { amiId, os });

    // Step 5: Launch EC2 instance with SSM support
    const instanceId = await launchInstanceWithKey(ec2Client, {
      amiId,
      instanceType,
      securityGroupId,
      keyPairName,
      projectName,
      iamClient,
    });
    logger.info('EC2Enhanced: Instance launched', { instanceId });

    // Step 6: Wait for instance to be running
    const instance = await waitForInstanceRunning(ec2Client, instanceId);
    logger.info('EC2Enhanced: Instance running', { instanceId, privateIp: instance.privateIp });

    // Step 7: Allocate and associate Elastic IP
    const publicIp = await allocateAndAssociateElasticIP(ec2Client, instanceId);
    logger.info('EC2Enhanced: Elastic IP allocated', { publicIp, instanceId });

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
    logger.error('EC2Enhanced: Deployment failed', { projectName, error: error.message, stack: error.stack });
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
 * Ensure SSM IAM role and instance profile exist
 */
async function ensureSSMInstanceProfile(iamClient) {
  const roleName = 'FocalDeploy-EC2-SSM-Role';
  const instanceProfileName = 'FocalDeploy-EC2-SSM-InstanceProfile';

  try {
    // Check if instance profile exists
    await iamClient.send(new GetInstanceProfileCommand({ InstanceProfileName: instanceProfileName }));
    logger.info('SSM: Instance profile already exists', { instanceProfileName });
    return instanceProfileName;
  } catch (err) {
    if (err.name !== 'NoSuchEntity') throw err;

    logger.info('SSM: Creating IAM role and instance profile for SSM');

    // Create IAM role
    try {
      await iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { Service: 'ec2.amazonaws.com' },
            Action: 'sts:AssumeRole'
          }]
        }),
        Description: 'Role for Focal Deploy EC2 instances to use SSM',
      }));
    } catch (roleErr) {
      if (roleErr.name !== 'EntityAlreadyExists') throw roleErr;
    }

    // Attach SSM managed policy
    await iamClient.send(new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
    }));

    // Create instance profile
    try {
      await iamClient.send(new CreateInstanceProfileCommand({ InstanceProfileName: instanceProfileName }));
    } catch (profileErr) {
      if (profileErr.name !== 'EntityAlreadyExists') throw profileErr;
    }

    // Add role to instance profile
    try {
      await iamClient.send(new AddRoleToInstanceProfileCommand({
        InstanceProfileName: instanceProfileName,
        RoleName: roleName
      }));
    } catch (addErr) {
      if (addErr.name !== 'LimitExceeded') throw addErr;
    }

    // Wait for instance profile to be ready
    await new Promise(resolve => setTimeout(resolve, 10000));

    logger.info('SSM: IAM role and instance profile created successfully');
    return instanceProfileName;
  }
}

/**
 * Launch EC2 instance with SSH keypair and SSM support
 */
async function launchInstanceWithKey(ec2Client, config) {
  const { amiId, instanceType, securityGroupId, keyPairName, projectName, iamClient } = config;

  // Ensure SSM instance profile exists
  const instanceProfileName = await ensureSSMInstanceProfile(iamClient);

  // UserData script to install and configure SSM agent
  const userData = Buffer.from(`#!/bin/bash
set -e

# Install SSM agent (usually pre-installed on Amazon Linux 2 and Ubuntu)
if ! systemctl is-active --quiet amazon-ssm-agent; then
  echo "Installing SSM agent..."
  if [ -f /etc/debian_version ]; then
    # Ubuntu/Debian
    wget https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb
    dpkg -i amazon-ssm-agent.deb
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent
  elif [ -f /etc/redhat-release ]; then
    # Amazon Linux/RHEL/CentOS
    yum install -y amazon-ssm-agent
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent
  fi
fi

echo "SSM agent installation complete"
`).toString('base64');

  const command = new RunInstancesCommand({
    ImageId: amiId,
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: keyPairName,
    SecurityGroupIds: [securityGroupId],
    IamInstanceProfile: { Name: instanceProfileName },
    UserData: userData,
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: `focal-deploy-${projectName}` },
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'Project', Value: projectName },
          { Key: 'SSMEnabled', Value: 'true' },
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
      logger.warn('EC2Enhanced: Could not delete keypair', { keyPairName, error: error.message });
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
