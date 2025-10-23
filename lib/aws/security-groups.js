const { 
  EC2Client, 
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  DeleteSecurityGroupCommand,
  RevokeSecurityGroupIngressCommand,
  CreateTagsCommand
} = require('@aws-sdk/client-ec2');
const { ErrorHandler } = require('../utils/errors');

class SecurityGroupManager {
  constructor(region, credentials) {
    this.region = region;
    this.credentials = credentials;
    this.client = new EC2Client({
      region: this.region,
      credentials: this.credentials
    });
  }

  async createSecurityGroup(config) {
    try {
      const projectName = config.project?.name || config.projectName || 'focal-deploy-project';
      const timestamp = Date.now().toString().slice(-8);
      const groupName = `${projectName}-sg-${timestamp}`;
      const description = `Security group for ${projectName} managed by focal-deploy`;

      // Check if security group already exists
      const existingGroup = await this.findSecurityGroup(groupName);
      if (existingGroup) {
        return {
          securityGroupId: existingGroup.GroupId,
          existed: true
        };
      }

      // Get default VPC
      const vpcId = await this.getDefaultVpcId();

      // Create security group
      const createCommand = new CreateSecurityGroupCommand({
        GroupName: groupName,
        Description: description,
        VpcId: vpcId
      });

      const response = await this.client.send(createCommand);
      const securityGroupId = response.GroupId;

      // Add tags (ensure all values are strings and not null)
      await this.client.send(new CreateTagsCommand({
        Resources: [securityGroupId],
        Tags: [
          { Key: 'Name', Value: groupName || '' },
          { Key: 'Project', Value: config.project?.name || config.projectName || 'focal-deploy-project' },
          { Key: 'ManagedBy', Value: 'focal-deploy' },
          { Key: 'Environment', Value: 'production' }
        ]
      }));

      // Configure security group rules
      await this.configureSecurityGroupRules(securityGroupId, config);

      return {
        securityGroupId,
        existed: false
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async configureSecurityGroupRules(securityGroupId, config) {
    try {
      const rules = this.generateSecurityGroupRules(config);

      for (const rule of rules) {
        await this.client.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: securityGroupId,
          IpPermissions: [rule]
        }));
      }

    } catch (error) {
      // If rules already exist, that's okay
      if (error.name !== 'InvalidPermission.Duplicate') {
        throw ErrorHandler.createAWSError(error);
      }
    }
  }

  generateSecurityGroupRules(config) {
    const rules = [];
    
    // Get SSH port from security configuration
    const sshPort = config.security?.ssh?.customPort || 
                   config.security?.firewall?.sshPort || 
                   config.infrastructure?.sshPort || 
                   2847; // Default secure port
    
    // SSH access (port 22 for initial setup - will be removed after hardening)
    rules.push({
      IpProtocol: 'tcp',
      FromPort: 22,
      ToPort: 22,
      IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'SSH access (initial setup - port 22)' }]
    });
    
    // SSH access (custom port for post-hardening)
    rules.push({
      IpProtocol: 'tcp',
      FromPort: sshPort,
      ToPort: sshPort,
      IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `SSH access (hardened - port ${sshPort})` }]
    });
    
    // HTTP access (port 80)
    rules.push({
      IpProtocol: 'tcp',
      FromPort: 80,
      ToPort: 80,
      IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTP access' }]
    });
    
    // HTTPS access (port 443)
    rules.push({
      IpProtocol: 'tcp',
      FromPort: 443,
      ToPort: 443,
      IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTPS access' }]
    });

    // Add custom application port if specified
    if (config.deployment && config.deployment.port && config.deployment.port !== 80 && config.deployment.port !== 443) {
      rules.push({
        IpProtocol: 'tcp',
        FromPort: config.deployment.port,
        ToPort: config.deployment.port,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `Application port ${config.deployment.port}` }]
      });
    }

    // Add database port if specified
    if (config.database && config.database.port) {
      rules.push({
        IpProtocol: 'tcp',
        FromPort: config.database.port,
        ToPort: config.database.port,
        IpRanges: [{ CidrIp: '10.0.0.0/8', Description: `Database port ${config.database.port} (VPC only)` }]
      });
    }

    return rules;
  }

  async findSecurityGroup(groupName) {
    try {
      const response = await this.client.send(new DescribeSecurityGroupsCommand({
        Filters: [
          {
            Name: 'group-name',
            Values: [groupName]
          }
        ]
      }));

      return response.SecurityGroups && response.SecurityGroups.length > 0 
        ? response.SecurityGroups[0] 
        : null;

    } catch (error) {
      if (error.name === 'InvalidGroup.NotFound') {
        return null;
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  async getDefaultVpcId() {
    try {
      const { DescribeVpcsCommand } = require('@aws-sdk/client-ec2');
      
      const response = await this.client.send(new DescribeVpcsCommand({
        Filters: [
          {
            Name: 'is-default',
            Values: ['true']
          }
        ]
      }));

      if (!response.Vpcs || response.Vpcs.length === 0) {
        throw new Error('No default VPC found. Please create a VPC first.');
      }

      return response.Vpcs[0].VpcId;

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async getSecurityGroupInfo(securityGroupId) {
    try {
      const response = await this.client.send(new DescribeSecurityGroupsCommand({
        GroupIds: [securityGroupId]
      }));

      const securityGroup = response.SecurityGroups[0];
      
      if (!securityGroup) {
        throw new Error(`Security group ${securityGroupId} not found`);
      }

      return {
        groupId: securityGroup.GroupId,
        groupName: securityGroup.GroupName,
        description: securityGroup.Description,
        vpcId: securityGroup.VpcId,
        inboundRules: securityGroup.IpPermissions.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          sources: rule.IpRanges.map(range => range.CidrIp)
        })),
        outboundRules: securityGroup.IpPermissionsEgress.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          destinations: rule.IpRanges.map(range => range.CidrIp)
        }))
      };

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async deleteSecurityGroup(securityGroupId) {
    try {
      await this.client.send(new DeleteSecurityGroupCommand({
        GroupId: securityGroupId
      }));

      return true;

    } catch (error) {
      if (error.name === 'InvalidGroup.NotFound') {
        return true; // Already deleted
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  async addRule(securityGroupId, rule) {
    try {
      await this.client.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: securityGroupId,
        IpPermissions: [rule]
      }));

      return true;

    } catch (error) {
      if (error.name === 'InvalidPermission.Duplicate') {
        return true; // Rule already exists
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  async updateSSHPort(securityGroupId, oldPort, newPort) {
    try {
      // Remove old SSH rule
      const oldRule = this.createRule('tcp', oldPort, oldPort, ['0.0.0.0/0'], 'SSH access (old)');
      await this.removeRule(securityGroupId, oldRule);

      // Add new SSH rule
      const newRule = this.createRule('tcp', newPort, newPort, ['0.0.0.0/0'], 'SSH access');
      await this.addRule(securityGroupId, newRule);

      return true;

    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async removeRule(securityGroupId, rule) {
    try {
      await this.client.send(new RevokeSecurityGroupIngressCommand({
        GroupId: securityGroupId,
        IpPermissions: [rule]
      }));

      return true;

    } catch (error) {
      if (error.name === 'InvalidPermission.NotFound') {
        return true; // Rule doesn't exist
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  // Helper method to create a rule object
  createRule(protocol, fromPort, toPort, cidrBlocks, description = '') {
    return {
      IpProtocol: protocol,
      FromPort: fromPort,
      ToPort: toPort,
      IpRanges: cidrBlocks.map(cidr => ({
        CidrIp: cidr,
        Description: description
      }))
    };
  }

  // Predefined rule templates
  static getRuleTemplates() {
    return {
      ssh: {
        IpProtocol: 'tcp',
        FromPort: 2847,
        ToPort: 2847,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'SSH access' }]
      },
      http: {
        IpProtocol: 'tcp',
        FromPort: 80,
        ToPort: 80,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTP access' }]
      },
      https: {
        IpProtocol: 'tcp',
        FromPort: 443,
        ToPort: 443,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTPS access' }]
      },
      mysql: {
        IpProtocol: 'tcp',
        FromPort: 3306,
        ToPort: 3306,
        IpRanges: [{ CidrIp: '10.0.0.0/8', Description: 'MySQL access (VPC only)' }]
      },
      postgresql: {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        IpRanges: [{ CidrIp: '10.0.0.0/8', Description: 'PostgreSQL access (VPC only)' }]
      },
      redis: {
        IpProtocol: 'tcp',
        FromPort: 6379,
        ToPort: 6379,
        IpRanges: [{ CidrIp: '10.0.0.0/8', Description: 'Redis access (VPC only)' }]
      }
    };
  }

  // ...
  // Emergency access methods for security group management
  async enableEmergencyAccess(securityGroupId, emergencyPorts = [2847]) {
    try {
      console.log('🚨 Enabling emergency access ports...');
      
      const emergencyRules = emergencyPorts.map(port => ({
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `Emergency SSH access - Port ${port}` }]
      }));

      for (const rule of emergencyRules) {
        try {
          await this.addRule(securityGroupId, rule);
          console.log(`✓ Emergency access enabled on port ${rule.FromPort}`);
        } catch (error) {
          if (error.name === 'InvalidPermission.Duplicate') {
            console.log(`✓ Port ${rule.FromPort} already accessible`);
          } else {
            console.warn(`⚠️ Could not enable port ${rule.FromPort}: ${error.message}`);
          }
        }
      }

      return true;
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async disableEmergencyAccess(securityGroupId, emergencyPorts = [2847]) {
    try {
      console.log('🔒 Disabling emergency access ports...');
      
      // Keep port 22 open, but remove emergency ports
      const emergencyRules = emergencyPorts.map(port => ({
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `Emergency SSH access - Port ${port}` }]
      }));

      for (const rule of emergencyRules) {
        try {
          await this.removeRule(securityGroupId, rule);
          console.log(`✓ Emergency port ${rule.FromPort} disabled`);
        } catch (error) {
          if (error.name === 'InvalidPermission.NotFound') {
            console.log(`✓ Port ${rule.FromPort} already disabled`);
          } else {
            console.warn(`⚠️ Could not disable port ${rule.FromPort}: ${error.message}`);
          }
        }
      }

      return true;
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  async updateSSHPort(securityGroupId, newPort = 2847) {
    try {
      console.log(`🔧 Updating SSH access to port ${newPort}...`);
      
      // Add new SSH port
      const newSSHRule = {
        IpProtocol: 'tcp',
        FromPort: newPort,
        ToPort: newPort,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `SSH access - Port ${newPort}` }]
      };

      await this.addRule(securityGroupId, newSSHRule);
      console.log(`✓ SSH access enabled on port ${newPort}`);

      return true;
    } catch (error) {
      if (error.name === 'InvalidPermission.Duplicate') {
        console.log(`✓ Port ${newPort} already accessible`);
        return true;
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  /**
   * Allow SSH access on a specific port during hardening transition
   * This method is used during Phase 3 of SSH hardening to enable dual-port access
   */
  async allowSSHPort(securityGroupId, port) {
    try {
      console.log(`🔧 Adding SSH access on port ${port}...`);
      
      const sshRule = {
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: `SSH access - Port ${port}` }]
      };

      await this.addRule(securityGroupId, sshRule);
      console.log(`✓ SSH access enabled on port ${port}`);

      return true;
    } catch (error) {
      if (error.name === 'InvalidPermission.Duplicate') {
        console.log(`✓ Port ${port} already accessible`);
        return true;
      }
      throw ErrorHandler.createAWSError(error);
    }
  }

  async getEmergencyAccessStatus(securityGroupId) {
    try {
      const sgInfo = await this.getSecurityGroupInfo(securityGroupId);
      
      const emergencyPorts = [22, 2847];
      const accessiblePorts = [];
      
      for (const rule of sgInfo.inboundRules) {
        if (rule.protocol === 'tcp' && emergencyPorts.includes(rule.fromPort)) {
          accessiblePorts.push({
            port: rule.fromPort,
            sources: rule.sources,
            accessible: rule.sources.includes('0.0.0.0/0')
          });
        }
      }

      return {
        securityGroupId,
        emergencyAccessEnabled: accessiblePorts.some(p => p.accessible),
        accessiblePorts,
        sshPort22: accessiblePorts.find(p => p.port === 22)?.accessible || false,
        customSSHPort: accessiblePorts.find(p => p.port === 2847)?.accessible || false,
        emergencyPort: accessiblePorts.find(p => p.port === 2847)?.accessible || false
      };
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }

  /**
   * Remove port 22 access after SSH hardening is complete
   * This should be called after SSH daemon has been reconfigured to use custom port
   */
  async removeInitialSSHAccess(securityGroupId) {
    try {
      console.log('🔒 Removing initial SSH access on port 22...');
      
      const port22Rule = {
        IpProtocol: 'tcp',
        FromPort: 22,
        ToPort: 22,
        IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'SSH access (initial setup - port 22)' }]
      };

      await this.removeRule(securityGroupId, port22Rule);
      console.log('✓ Port 22 SSH access removed - security hardening complete');
      
      return true;
    } catch (error) {
      if (error.name === 'InvalidPermission.NotFound') {
        console.log('✓ Port 22 SSH access already removed');
        return true;
      }
      console.error('❌ Failed to remove port 22 SSH access:', error.message);
      throw ErrorHandler.createAWSError(error);
    }
  }

  /**
   * Verify that SSH hardening transition is complete
   * Checks that port 22 is closed and custom port is open
   */
  async verifySSHHardeningTransition(securityGroupId, customPort) {
    try {
      const sgInfo = await this.getSecurityGroupInfo(securityGroupId);
      
      let port22Open = false;
      let customPortOpen = false;
      
      for (const rule of sgInfo.inboundRules) {
        if (rule.protocol === 'tcp') {
          if (rule.fromPort === 22 && rule.sources.includes('0.0.0.0/0')) {
            port22Open = true;
          }
          if (rule.fromPort === customPort && rule.sources.includes('0.0.0.0/0')) {
            customPortOpen = true;
          }
        }
      }

      return {
        hardeningComplete: !port22Open && customPortOpen,
        port22Closed: !port22Open,
        customPortOpen: customPortOpen,
        customPort: customPort
      };
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }
}

module.exports = SecurityGroupManager;