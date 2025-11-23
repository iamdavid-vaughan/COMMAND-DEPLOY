/**
 * EC2 Deployment Service - Handle AWS EC2 instance creation and management
 */

const {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
  DescribeInstanceStatusCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  AllocateAddressCommand,
  AssociateAddressCommand,
  ReleaseAddressCommand,
  CreateTagsCommand,
} = require('@aws-sdk/client-ec2');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const logger = require('../utils/logger');

/**
 * Create EC2 deployment with user's AWS credentials
 */
async function createDeployment(awsCredentials, deploymentConfig) {
  const {
    region = 'us-east-1',
    instanceType = 't3.micro',
    projectName,
    domains = [],
    configuration = {},
  } = deploymentConfig;

  const { accessKeyId, secretAccessKey } = awsCredentials;

  // Create EC2 client with user's credentials
  const ec2Client = new EC2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    // Step 1: Verify credentials
    logger.info('EC2: Starting deployment', { projectName, region, instanceType });
    const accountId = await verifyCredentials(accessKeyId, secretAccessKey, region);
    logger.info('EC2: Verified AWS credentials', { accountId });

    // Step 2: Create or get security group
    const securityGroupId = await createSecurityGroup(ec2Client, projectName);
    logger.info('EC2: Security group ready', { securityGroupId });

    // Step 3: Get latest Amazon Linux 2 AMI (hardcoded for common regions)
    const amiId = getAmazonLinuxAMI(region);
    logger.info('EC2: Using AMI', { amiId });

    // Step 4: Create user data script for instance initialization
    const userData = createUserDataScript(projectName, configuration);

    // Step 5: Launch EC2 instance
    const instanceId = await launchInstance(ec2Client, {
      amiId,
      instanceType,
      securityGroupId,
      userData,
      projectName,
    });
    logger.info('EC2: Instance launched', { instanceId });

    // Step 6: Wait for instance to be running
    const instance = await waitForInstance(ec2Client, instanceId);
    logger.info('EC2: Instance running', { instanceId, privateIp: instance.privateIp });

    // Step 7: Allocate and associate Elastic IP
    const publicIp = await allocateElasticIP(ec2Client, instanceId);
    logger.info('EC2: Elastic IP allocated', { publicIp, instanceId });

    return {
      success: true,
      instanceId,
      publicIp,
      privateIp: instance.privateIp,
      securityGroupId,
      region,
      message: 'EC2 instance created successfully',
    };
  } catch (error) {
    logger.error('EC2: Deployment failed', { projectName, error: error.message, stack: error.stack });
    throw new Error(`EC2 deployment failed: ${error.message}`);
  }
}

/**
 * Terminate EC2 deployment
 */
async function terminateDeployment(awsCredentials, deploymentInfo) {
  const { region, instanceId } = deploymentInfo;
  const { accessKeyId, secretAccessKey } = awsCredentials;

  const ec2Client = new EC2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    logger.info('EC2: Terminating instance', { instanceId, region });

    // Terminate instance
    const command = new TerminateInstancesCommand({
      InstanceIds: [instanceId],
    });

    await ec2Client.send(command);
    logger.info('EC2: Instance terminated', { instanceId });

    // Note: Elastic IP should be released manually or via cleanup job
    // to avoid leaving orphaned IPs

    return {
      success: true,
      message: 'Instance terminated successfully',
    };
  } catch (error) {
    logger.error('EC2: Termination failed', { instanceId, region, error: error.message, stack: error.stack });
    throw new Error(`EC2 termination failed: ${error.message}`);
  }
}

/**
 * Get deployment status
 */
async function getDeploymentStatus(awsCredentials, deploymentInfo) {
  const { region, instanceId } = deploymentInfo;
  const { accessKeyId, secretAccessKey } = awsCredentials;

  const ec2Client = new EC2Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    });

    const response = await ec2Client.send(command);
    const instance = response.Reservations?.[0]?.Instances?.[0];

    if (!instance) {
      throw new Error('Instance not found');
    }

    return {
      success: true,
      state: instance.State.Name, // pending, running, stopping, stopped, terminated
      publicIp: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      launchTime: instance.LaunchTime,
    };
  } catch (error) {
    logger.error('EC2: Status check failed', { instanceId, error: error.message, stack: error.stack });
    throw new Error(`Failed to get instance status: ${error.message}`);
  }
}

/**
 * Verify AWS credentials
 */
async function verifyCredentials(accessKeyId, secretAccessKey, region) {
  const stsClient = new STSClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    return response.Account;
  } catch (error) {
    throw new Error('Invalid AWS credentials');
  }
}

/**
 * Create or get security group
 */
async function createSecurityGroup(ec2Client, projectName) {
  const groupName = `focal-deploy-${projectName}`;
  const description = `Security group for Focal Deploy project: ${projectName}`;

  try {
    // Check if security group already exists
    const describeCommand = new DescribeSecurityGroupsCommand({
      Filters: [
        {
          Name: 'group-name',
          Values: [groupName],
        },
      ],
    });

    const existingGroups = await ec2Client.send(describeCommand);

    if (existingGroups.SecurityGroups && existingGroups.SecurityGroups.length > 0) {
      return existingGroups.SecurityGroups[0].GroupId;
    }

    // Create new security group
    const createCommand = new CreateSecurityGroupCommand({
      GroupName: groupName,
      Description: description,
    });

    const createResponse = await ec2Client.send(createCommand);
    const groupId = createResponse.GroupId;

    // Add inbound rules (HTTP, HTTPS, SSH)
    const authorizeCommand = new AuthorizeSecurityGroupIngressCommand({
      GroupId: groupId,
      IpPermissions: [
        {
          // SSH
          IpProtocol: 'tcp',
          FromPort: 22,
          ToPort: 22,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
        {
          // HTTP
          IpProtocol: 'tcp',
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
        {
          // HTTPS
          IpProtocol: 'tcp',
          FromPort: 443,
          ToPort: 443,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
        {
          // Custom app port (3000)
          IpProtocol: 'tcp',
          FromPort: 3000,
          ToPort: 3000,
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        },
      ],
    });

    await ec2Client.send(authorizeCommand);

    return groupId;
  } catch (error) {
    throw new Error(`Failed to create security group: ${error.message}`);
  }
}

/**
 * Launch EC2 instance
 */
async function launchInstance(ec2Client, config) {
  const { amiId, instanceType, securityGroupId, userData, projectName } = config;

  const command = new RunInstancesCommand({
    ImageId: amiId,
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: [securityGroupId],
    UserData: Buffer.from(userData).toString('base64'),
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          {
            Key: 'Name',
            Value: `focal-deploy-${projectName}`,
          },
          {
            Key: 'ManagedBy',
            Value: 'FocalDeploy',
          },
          {
            Key: 'Project',
            Value: projectName,
          },
        ],
      },
    ],
  });

  const response = await ec2Client.send(command);
  const instanceId = response.Instances[0].InstanceId;

  return instanceId;
}

/**
 * Wait for instance to be running
 */
async function waitForInstance(ec2Client, instanceId, maxAttempts = 30) {
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
async function allocateElasticIP(ec2Client, instanceId) {
  try {
    // Allocate new Elastic IP
    const allocateCommand = new AllocateAddressCommand({
      Domain: 'vpc',
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
  } catch (error) {
    throw new Error(`Failed to allocate Elastic IP: ${error.message}`);
  }
}

/**
 * Create user data script for instance initialization
 */
function createUserDataScript(projectName, configuration) {
  // Basic initialization script
  // This can be customized based on configuration
  const script = `#!/bin/bash
# Focal Deploy initialization script
# Project: ${projectName}

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install Git
yum install -y git

# Install PM2 globally
npm install -g pm2

# Install Nginx
amazon-linux-extras install nginx1 -y

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create application directory
mkdir -p /var/www/${projectName}
cd /var/www/${projectName}

# Set permissions
chown -R ec2-user:ec2-user /var/www/${projectName}

# Log completion
echo "Focal Deploy initialization complete" > /var/log/focal-deploy-init.log
date >> /var/log/focal-deploy-init.log

# Additional custom configuration
${configuration.customScript || '# No custom script provided'}
`;

  return script;
}

/**
 * Get Amazon Linux 2 AMI for region
 * In production, this should query AWS SSM Parameter Store for latest AMI
 */
function getAmazonLinuxAMI(region) {
  const amiMap = {
    'us-east-1': 'ami-0c55b159cbfafe1f0', // Amazon Linux 2 (us-east-1)
    'us-east-2': 'ami-0d5d9d301c853a04a',
    'us-west-1': 'ami-04e59c05167ea7bd5',
    'us-west-2': 'ami-0b152cfd354c4c7a4',
    'eu-west-1': 'ami-0ea3405d2d2522162',
    'eu-central-1': 'ami-0c960b947cbb2dd16',
    'ap-southeast-1': 'ami-0c802847a7dd848c0',
    'ap-northeast-1': 'ami-00d101850e971728d',
  };

  return (
    amiMap[region] || 'ami-0c55b159cbfafe1f0' // Default to us-east-1
  );
}

module.exports = {
  createDeployment,
  terminateDeployment,
  getDeploymentStatus,
};
