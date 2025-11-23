const {
  RDSClient,
  CreateDBInstanceCommand,
  DeleteDBInstanceCommand,
  DescribeDBInstancesCommand,
  CreateDBSubnetGroupCommand,
  DescribeDBSubnetGroupsCommand
} = require('@aws-sdk/client-rds');
const {
  EC2Client,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand
} = require('@aws-sdk/client-ec2');
const crypto = require('crypto');
const logger = require('../utils/logger');

class RDSService {
  /**
   * Create a new RDS MySQL instance
   * @param {Object} options - RDS configuration options
   * @param {string} options.projectName - Project name for instance identifier
   * @param {string} options.region - AWS region
   * @param {Object} options.awsCredentials - AWS credentials
   * @param {string} options.vpcId - VPC ID
   * @param {string} [options.instanceClass='db.t3.micro'] - RDS instance class
   * @param {number} [options.allocatedStorage=20] - Storage in GB
   * @param {string} [options.engine='mysql'] - Database engine
   * @param {string} [options.engineVersion='8.0.35'] - Engine version
   * @param {boolean} [options.multiAZ=false] - Enable Multi-AZ
   * @param {number} [options.backupRetentionDays=7] - Backup retention period
   * @param {string} [options.dbName='wordpress'] - Initial database name
   * @returns {Promise<Object>} RDS instance details and connection info
   */
  async createMySQLInstance(options) {
    const {
      projectName,
      region,
      awsCredentials,
      vpcId,
      instanceClass = 'db.t3.micro',
      allocatedStorage = 20,
      engine = 'mysql',
      engineVersion = '8.0.35',
      multiAZ = false,
      backupRetentionDays = 7,
      dbName = 'wordpress'
    } = options;

    const rdsClient = new RDSClient({
      region,
      credentials: awsCredentials
    });

    const ec2Client = new EC2Client({
      region,
      credentials: awsCredentials
    });

    try {
      logger.info('RDS: Creating MySQL instance', { projectName, region, instanceClass });

      // Generate unique instance identifier
      const instanceIdentifier = `focal-deploy-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`;

      // Generate secure password
      const masterPassword = this.generateSecurePassword();
      const masterUsername = 'focaladmin';

      // Create security group for RDS
      logger.info('RDS: Creating security group', { vpcId });
      const securityGroupId = await this.createRDSSecurityGroup(ec2Client, vpcId, projectName);

      // Create DB subnet group
      logger.info('RDS: Creating DB subnet group', { vpcId });
      const subnetGroupName = await this.ensureDBSubnetGroup(rdsClient, ec2Client, vpcId, projectName, region);

      // Create RDS instance
      logger.info('RDS: Launching instance', { instanceIdentifier, engine, engineVersion });

      const createCommand = new CreateDBInstanceCommand({
        DBInstanceIdentifier: instanceIdentifier,
        DBInstanceClass: instanceClass,
        Engine: engine,
        EngineVersion: engineVersion,
        MasterUsername: masterUsername,
        MasterUserPassword: masterPassword,
        AllocatedStorage: allocatedStorage,
        StorageType: 'gp3',
        StorageEncrypted: true,
        VpcSecurityGroupIds: [securityGroupId],
        DBSubnetGroupName: subnetGroupName,
        MultiAZ: multiAZ,
        BackupRetentionPeriod: backupRetentionDays,
        PreferredBackupWindow: '03:00-04:00',
        PreferredMaintenanceWindow: 'mon:04:00-mon:05:00',
        DBName: dbName,
        PubliclyAccessible: false,
        EnableCloudwatchLogsExports: ['error', 'general', 'slowquery'],
        DeletionProtection: false,
        Tags: [
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'Project', Value: projectName },
          { Key: 'CreatedAt', Value: new Date().toISOString() }
        ]
      });

      const response = await rdsClient.send(createCommand);
      logger.info('RDS: Instance creation initiated', { instanceIdentifier });

      // Wait for instance to become available
      logger.info('RDS: Waiting for instance to become available', { instanceIdentifier });
      const instanceDetails = await this.waitForInstanceAvailable(rdsClient, instanceIdentifier);

      const endpoint = instanceDetails.Endpoint.Address;
      const port = instanceDetails.Endpoint.Port;

      logger.info('RDS: Instance is available', { instanceIdentifier, endpoint, port });

      return {
        instanceIdentifier,
        endpoint,
        port,
        masterUsername,
        masterPassword,
        dbName,
        engine,
        engineVersion,
        instanceClass,
        allocatedStorage,
        securityGroupId,
        subnetGroupName,
        connectionString: `mysql://${masterUsername}:${masterPassword}@${endpoint}:${port}/${dbName}`,
        status: 'available'
      };

    } catch (error) {
      logger.error('RDS: Failed to create instance', {
        error: error.message,
        stack: error.stack,
        projectName
      });
      throw error;
    }
  }

  /**
   * Create security group for RDS instance
   */
  async createRDSSecurityGroup(ec2Client, vpcId, projectName) {
    try {
      const groupName = `focal-deploy-rds-${projectName}-${Date.now()}`;

      // Create security group
      const createSGCommand = new CreateSecurityGroupCommand({
        GroupName: groupName,
        Description: `RDS security group for ${projectName}`,
        VpcId: vpcId,
        TagSpecifications: [{
          ResourceType: 'security-group',
          Tags: [
            { Key: 'Name', Value: groupName },
            { Key: 'ManagedBy', Value: 'FocalDeploy' },
            { Key: 'Project', Value: projectName }
          ]
        }]
      });

      const sgResponse = await ec2Client.send(createSGCommand);
      const securityGroupId = sgResponse.GroupId;

      logger.info('RDS: Security group created', { securityGroupId, groupName });

      // Allow MySQL port 3306 from VPC
      const authorizeCommand = new AuthorizeSecurityGroupIngressCommand({
        GroupId: securityGroupId,
        IpPermissions: [
          {
            IpProtocol: 'tcp',
            FromPort: 3306,
            ToPort: 3306,
            IpRanges: [{ CidrIp: '10.0.0.0/16', Description: 'VPC CIDR' }]
          }
        ]
      });

      await ec2Client.send(authorizeCommand);
      logger.info('RDS: Security group ingress rules added', { securityGroupId });

      return securityGroupId;

    } catch (error) {
      logger.error('RDS: Failed to create security group', {
        error: error.message,
        vpcId
      });
      throw error;
    }
  }

  /**
   * Ensure DB subnet group exists or create it
   */
  async ensureDBSubnetGroup(rdsClient, ec2Client, vpcId, projectName, region) {
    const subnetGroupName = `focal-deploy-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-subnet-group`;

    try {
      // Check if subnet group already exists
      const describeCommand = new DescribeDBSubnetGroupsCommand({
        DBSubnetGroupName: subnetGroupName
      });

      const existing = await rdsClient.send(describeCommand);
      if (existing.DBSubnetGroups && existing.DBSubnetGroups.length > 0) {
        logger.info('RDS: DB subnet group already exists', { subnetGroupName });
        return subnetGroupName;
      }
    } catch (error) {
      // Subnet group doesn't exist, create it
      logger.info('RDS: DB subnet group does not exist, creating', { subnetGroupName });
    }

    try {
      // Get all subnets in VPC
      const describeSubnetsCommand = new DescribeSubnetsCommand({
        Filters: [
          { Name: 'vpc-id', Values: [vpcId] }
        ]
      });

      const subnetsResponse = await ec2Client.send(describeSubnetsCommand);
      const subnets = subnetsResponse.Subnets || [];

      if (subnets.length < 2) {
        throw new Error('VPC must have at least 2 subnets in different availability zones for RDS');
      }

      // Get subnets from different AZs
      const uniqueAZs = new Map();
      subnets.forEach(subnet => {
        if (!uniqueAZs.has(subnet.AvailabilityZone)) {
          uniqueAZs.set(subnet.AvailabilityZone, subnet.SubnetId);
        }
      });

      const subnetIds = Array.from(uniqueAZs.values()).slice(0, 2);

      // Create DB subnet group
      const createSubnetGroupCommand = new CreateDBSubnetGroupCommand({
        DBSubnetGroupName: subnetGroupName,
        DBSubnetGroupDescription: `DB subnet group for ${projectName}`,
        SubnetIds: subnetIds,
        Tags: [
          { Key: 'ManagedBy', Value: 'FocalDeploy' },
          { Key: 'Project', Value: projectName }
        ]
      });

      await rdsClient.send(createSubnetGroupCommand);
      logger.info('RDS: DB subnet group created', {
        subnetGroupName,
        subnetIds: subnetIds.join(', ')
      });

      return subnetGroupName;

    } catch (error) {
      logger.error('RDS: Failed to create DB subnet group', {
        error: error.message,
        subnetGroupName
      });
      throw error;
    }
  }

  /**
   * Wait for RDS instance to become available
   */
  async waitForInstanceAvailable(rdsClient, instanceIdentifier, maxAttempts = 60) {
    let attempts = 0;
    const delayMs = 10000; // 10 seconds

    while (attempts < maxAttempts) {
      try {
        const instance = await this.getInstance(rdsClient, instanceIdentifier);

        if (instance.DBInstanceStatus === 'available') {
          return instance;
        }

        if (instance.DBInstanceStatus === 'failed') {
          throw new Error('RDS instance creation failed');
        }

        logger.info('RDS: Instance status', {
          instanceIdentifier,
          status: instance.DBInstanceStatus,
          attempt: attempts + 1,
          maxAttempts
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempts++;

      } catch (error) {
        logger.error('RDS: Error checking instance status', {
          error: error.message,
          instanceIdentifier
        });
        throw error;
      }
    }

    throw new Error(`RDS instance did not become available within ${maxAttempts * delayMs / 1000} seconds`);
  }

  /**
   * Get RDS instance details
   */
  async getInstance(rdsClient, instanceIdentifier) {
    try {
      const command = new DescribeDBInstancesCommand({
        DBInstanceIdentifier: instanceIdentifier
      });

      const response = await rdsClient.send(command);

      if (!response.DBInstances || response.DBInstances.length === 0) {
        throw new Error(`RDS instance not found: ${instanceIdentifier}`);
      }

      return response.DBInstances[0];

    } catch (error) {
      logger.error('RDS: Failed to get instance details', {
        error: error.message,
        instanceIdentifier
      });
      throw error;
    }
  }

  /**
   * Delete RDS instance
   */
  async deleteInstance(rdsClient, instanceIdentifier, skipFinalSnapshot = true) {
    try {
      logger.info('RDS: Deleting instance', { instanceIdentifier });

      const command = new DeleteDBInstanceCommand({
        DBInstanceIdentifier: instanceIdentifier,
        SkipFinalSnapshot: skipFinalSnapshot,
        DeleteAutomatedBackups: true
      });

      await rdsClient.send(command);
      logger.info('RDS: Instance deletion initiated', { instanceIdentifier });

      return { success: true, instanceIdentifier };

    } catch (error) {
      logger.error('RDS: Failed to delete instance', {
        error: error.message,
        instanceIdentifier
      });
      throw error;
    }
  }

  /**
   * Generate cryptographically secure password
   */
  generateSecurePassword(length = 32) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }
}

module.exports = new RDSService();
