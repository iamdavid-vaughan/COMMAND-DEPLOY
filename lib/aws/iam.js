const { 
  IAMClient, 
  CreateRoleCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  AddRoleToInstanceProfileCommand,
  GetRoleCommand,
  GetInstanceProfileCommand,
  ListAttachedRolePoliciesCommand
} = require('@aws-sdk/client-iam');
const { ErrorHandler } = require('../utils/errors');

class IAMManager {
  constructor(region, credentials) {
    this.region = region;
    this.credentials = credentials;
    this.client = new IAMClient({
      region: this.region,
      credentials: this.credentials
    });
  }

  async createSSMRole(projectName) {
    try {
      const roleName = `${projectName}-ssm-role`;
      const instanceProfileName = `${projectName}-ssm-instance-profile`;

      console.log(`🔍 Checking for existing IAM role: ${roleName}`);
      
      // Check if role already exists
      const existingRole = await this.getRoleIfExists(roleName);
      if (existingRole) {
        console.log(`✓ IAM role ${roleName} already exists`);
        
        // Check if instance profile exists
        const existingProfile = await this.getInstanceProfileIfExists(instanceProfileName);
        if (existingProfile) {
          console.log(`✓ Instance profile ${instanceProfileName} already exists`);
          return {
            roleName,
            roleArn: existingRole.Arn,
            instanceProfileName,
            instanceProfileArn: existingProfile.Arn,
            existed: true
          };
        }
      }

      // Create IAM role for EC2 instances
      const assumeRolePolicyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      };

      let roleArn;
      if (!existingRole) {
        console.log(`🔨 Creating IAM role: ${roleName}`);
        console.log(`📋 Role policy document: ${JSON.stringify(assumeRolePolicyDocument, null, 2)}`);
        
        try {
          const createRoleCommand = new CreateRoleCommand({
            RoleName: roleName,
            AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
            Description: `IAM role for ${projectName} EC2 instances with SSM access`,
            Tags: [
              { Key: 'Project', Value: projectName },
              { Key: 'ManagedBy', Value: 'focal-deploy' },
              { Key: 'Purpose', Value: 'SSM-Emergency-Access' }
            ]
          });

          const roleResponse = await this.client.send(createRoleCommand);
          roleArn = roleResponse.Role.Arn;
          console.log(`✓ Created IAM role: ${roleName} (ARN: ${roleArn})`);
          
          // Verify role was actually created by checking it exists
          console.log(`🔍 Verifying role creation...`);
          const verifyRole = await this.getRoleIfExists(roleName);
          if (!verifyRole) {
            throw new Error(`Role creation appeared to succeed but role ${roleName} cannot be found immediately after creation`);
          }
          console.log(`✓ Role creation verified successfully`);
          
        } catch (roleError) {
          console.error(`❌ Failed to create IAM role ${roleName}:`);
          console.error(`   Error name: ${roleError.name}`);
          console.error(`   Error code: ${roleError.$metadata?.httpStatusCode || 'unknown'}`);
          console.error(`   Error message: ${roleError.message}`);
          
          // Check for specific permission errors
          if (roleError.name === 'AccessDenied' || roleError.name === 'UnauthorizedOperation') {
            throw new Error(`Insufficient permissions to create IAM role. Required permissions: iam:CreateRole, iam:TagRole. Error: ${roleError.message}`);
          } else if (roleError.name === 'EntityAlreadyExists') {
            console.log(`⚠️  Role ${roleName} already exists (race condition), attempting to retrieve it...`);
            const existingRoleRetry = await this.getRoleIfExists(roleName);
            if (existingRoleRetry) {
              roleArn = existingRoleRetry.Arn;
              console.log(`✓ Retrieved existing role: ${roleName} (ARN: ${roleArn})`);
            } else {
              throw new Error(`Role ${roleName} reported as existing but cannot be retrieved`);
            }
          } else {
            throw roleError;
          }
        }
      } else {
        roleArn = existingRole.Arn;
      }

      // Attach AWS managed policies for SSM
      console.log(`🔗 Attaching policies to role: ${roleName}`);
      const policies = [
        'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy'
      ];

      for (const policyArn of policies) {
        try {
          console.log(`   Attaching policy: ${policyArn.split('/').pop()}`);
          await this.client.send(new AttachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: policyArn
          }));
          console.log(`✓ Attached policy: ${policyArn.split('/').pop()}`);
        } catch (error) {
          if (error.name === 'EntityAlreadyExistsException' || error.name === 'EntityAlreadyExists') {
            console.log(`✓ Policy already attached: ${policyArn.split('/').pop()}`);
          } else {
            console.error(`❌ Failed to attach policy ${policyArn}:`);
            console.error(`   Error name: ${error.name}`);
            console.error(`   Error message: ${error.message}`);
            
            if (error.name === 'AccessDenied' || error.name === 'UnauthorizedOperation') {
              throw new Error(`Insufficient permissions to attach policies to IAM role. Required permissions: iam:AttachRolePolicy. Error: ${error.message}`);
            }
            throw error;
          }
        }
      }

      // Create instance profile
      let instanceProfileArn;
      const existingProfile = await this.getInstanceProfileIfExists(instanceProfileName);
      
      if (!existingProfile) {
        console.log(`🔨 Creating instance profile: ${instanceProfileName}`);
        
        try {
          const createProfileCommand = new CreateInstanceProfileCommand({
            InstanceProfileName: instanceProfileName,
            Tags: [
              { Key: 'Project', Value: projectName },
              { Key: 'ManagedBy', Value: 'focal-deploy' },
              { Key: 'Purpose', Value: 'SSM-Emergency-Access' }
            ]
          });

          const profileResponse = await this.client.send(createProfileCommand);
          instanceProfileArn = profileResponse.InstanceProfile.Arn;
          console.log(`✓ Created instance profile: ${instanceProfileName} (ARN: ${instanceProfileArn})`);

          // Add role to instance profile
          console.log(`🔗 Adding role ${roleName} to instance profile ${instanceProfileName}`);
          await this.client.send(new AddRoleToInstanceProfileCommand({
            InstanceProfileName: instanceProfileName,
            RoleName: roleName
          }));
          console.log(`✓ Added role to instance profile`);
          
        } catch (profileError) {
          console.error(`❌ Failed to create instance profile ${instanceProfileName}:`);
          console.error(`   Error name: ${profileError.name}`);
          console.error(`   Error message: ${profileError.message}`);
          
          if (profileError.name === 'AccessDenied' || profileError.name === 'UnauthorizedOperation') {
            throw new Error(`Insufficient permissions to create instance profile. Required permissions: iam:CreateInstanceProfile, iam:AddRoleToInstanceProfile. Error: ${profileError.message}`);
          }
          throw profileError;
        }
      } else {
        instanceProfileArn = existingProfile.Arn;
        console.log(`✓ Using existing instance profile: ${instanceProfileName}`);
      }

      console.log(`✅ SSM role setup completed successfully`);
      console.log(`   Role: ${roleName} (${roleArn})`);
      console.log(`   Instance Profile: ${instanceProfileName} (${instanceProfileArn})`);
      
      return {
        roleName,
        roleArn,
        instanceProfileName,
        instanceProfileArn,
        existed: !!existingRole
      };

    } catch (error) {
      console.error(`❌ Failed to create SSM role: ${error.message}`);
      console.error(`   Full error details:`, error);
      
      // Provide more specific error messages based on common issues
      if (error.message.includes('Insufficient permissions')) {
        throw new Error(`${error.message}\n\nRequired IAM permissions for your AWS user/role:\n- iam:CreateRole\n- iam:AttachRolePolicy\n- iam:CreateInstanceProfile\n- iam:AddRoleToInstanceProfile\n- iam:GetRole\n- iam:GetInstanceProfile\n- iam:TagRole`);
      }
      
      throw ErrorHandler.createAWSError(error);
    }
  }

  async getRoleIfExists(roleName) {
    try {
      const response = await this.client.send(new GetRoleCommand({
        RoleName: roleName
      }));
      return response.Role;
    } catch (error) {
      // Handle all variations of NoSuchEntity exceptions
      if (error.name === 'NoSuchEntity' || 
          error.name === 'NoSuchEntityException' || 
          error.Error?.Code === 'NoSuchEntity' ||
          error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`❌ Unexpected error checking for role ${roleName}:`, error);
      throw error;
    }
  }

  async getInstanceProfileIfExists(instanceProfileName) {
    try {
      const response = await this.client.send(new GetInstanceProfileCommand({
        InstanceProfileName: instanceProfileName
      }));
      return response.InstanceProfile;
    } catch (error) {
      // Handle all variations of NoSuchEntity exceptions
      if (error.name === 'NoSuchEntity' || 
          error.name === 'NoSuchEntityException' || 
          error.Error?.Code === 'NoSuchEntity' ||
          error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`❌ Unexpected error checking for instance profile ${instanceProfileName}:`, error);
      throw error;
    }
  }

  async getRoleInfo(roleName) {
    try {
      const roleResponse = await this.client.send(new GetRoleCommand({
        RoleName: roleName
      }));

      const policiesResponse = await this.client.send(new ListAttachedRolePoliciesCommand({
        RoleName: roleName
      }));

      return {
        roleName: roleResponse.Role.RoleName,
        roleArn: roleResponse.Role.Arn,
        createdDate: roleResponse.Role.CreateDate,
        attachedPolicies: policiesResponse.AttachedPolicies.map(policy => ({
          policyName: policy.PolicyName,
          policyArn: policy.PolicyArn
        }))
      };
    } catch (error) {
      throw ErrorHandler.createAWSError(error);
    }
  }
}

module.exports = IAMManager;