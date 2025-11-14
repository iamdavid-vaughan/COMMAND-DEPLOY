# SaaS Deployment Fix - Comprehensive Implementation Plan

## Current Status
✅ Phase 1 Complete: Deployment Executor contract documented
📋 Ready to proceed with implementation

## The Core Problem
The SaaS `deploymentWorker.js` calls EC2 APIs directly instead of using the tested CLI deployment executor. This causes:
- Elastic IP errors (executor doesn't use them)
- Missing S3 bucket creation
- Wrong security group configuration
- Missing features (Debian OS, SSL config, etc.)

## Implementation Phases

### Phase 2: Update SaaS Deployment Form ⏳

**File:** `dashboard/src/app/dashboard/deployments/new/page.tsx`

**Changes Needed:**

1. **Add Debian to OS Options**
```typescript
const OS_OPTIONS = [
  { value: 'ubuntu', label: 'Ubuntu 22.04 LTS', recommended: true },
  { value: 'debian', label: 'Debian 12 (Bookworm)' },
];
```

2. **Add SSL Configuration Fields** (Step 5)
```typescript
sslEmail: '',
sslChallengeType: 'dns-01', // or 'http-01'
sslUseStaging: false, // for testing
```

3. **Add Domain List Support**
```typescript
domains: [] as string[],  // instead of single customDomain
primaryDomain: '',
```

4. **Add Storage Configuration** (Step 2)
```typescript
storageRootSize: 20, // GB
storageDataSize: 10, // GB
```

5. **Add Validation**
- Reject port 22 for SSH
- Reject OS default usernames ('ubuntu', 'admin', 'ec2-user', 'root')

**Priority:** HIGH - Form must collect all data before backend can work

---

### Phase 3: Create Deployment Bridge ⏳

**New File:** `saas-server/services/deploymentBridge.js`

```javascript
/**
 * Deployment Bridge - Translates SaaS config to CLI format
 * and calls the actual deployment executor
 */
const path = require('path');
const fs = require('fs-extra');
const { DeploymentExecutor } = require('../../lib/wizard/deployment-executor');
const { getModels } = require('../models');

class DeploymentBridge {
  /**
   * Execute deployment using CLI deployment executor
   */
  async executeDeployment(deploymentId, saasConfig, userId) {
    // 1. Get user's stored credentials from database
    const credentials = await this.getStoredCredentials(userId);

    // 2. Create project directory
    const projectPath = await this.createProjectDirectory(deploymentId, saasConfig.projectName);

    // 3. Build CLI-compatible stepData
    const stepData = this.buildStepData(saasConfig, credentials);

    // 4. Call the ACTUAL deployment executor (the one the CLI uses)
    const executor = new DeploymentExecutor();
    const result = await executor.execute(projectPath, stepData);

    return {
      ...result,
      projectPath
    };
  }

  /**
   * Get user's credentials from database
   */
  async getStoredCredentials(userId) {
    const { Credential } = getModels();

    // Get AWS credentials
    const awsCred = await Credential.findOne({
      where: { userId, type: 'aws' }
    });

    // Get GitHub credentials
    const githubCred = await Credential.findOne({
      where: { userId, type: 'github' }
    });

    // Get DNS credentials (optional)
    const dnsCred = await Credential.findOne({
      where: { userId, type: 'dns' }
    });

    if (!awsCred) {
      throw new Error('AWS credentials not found. Please add AWS credentials first.');
    }

    return {
      aws: JSON.parse(awsCred.data),
      github: githubCred ? JSON.parse(githubCred.data) : null,
      dns: dnsCred ? JSON.parse(dnsCred.data) : null
    };
  }

  /**
   * Create temporary project directory for deployment
   */
  async createProjectDirectory(deploymentId, projectName) {
    const baseDir = path.join(require('os').tmpdir(), 'focal-deploy-saas');
    const projectPath = path.join(baseDir, `${projectName}-${deploymentId}`);

    await fs.ensureDir(projectPath);

    return projectPath;
  }

  /**
   * Build CLI-compatible stepData from SaaS configuration
   */
  buildStepData(saasConfig, credentials) {
    return {
      credentials: {
        aws: {
          accessKeyId: credentials.aws.accessKeyId,
          secretAccessKey: credentials.aws.secretAccessKey
        },
        github: credentials.github ? {
          token: credentials.github.token
        } : null,
        dns: credentials.dns || null
      },

      project: {
        name: saasConfig.projectName,
        type: saasConfig.applicationType || 'nodejs',
        port: saasConfig.applicationPort || 3000,
        description: `Deployed via Focal Deploy SaaS`
      },

      infrastructure: {
        region: saasConfig.region || 'us-east-1',
        instanceType: saasConfig.instanceType || 't3.micro',
        operatingSystem: this.mapOSValue(saasConfig.operatingSystem), // 'ubuntu' or 'debian'
        storage: {
          s3: {
            encryption: true,
            publicAccess: false
          },
          volumes: {
            root: saasConfig.storageRootSize || 20,
            data: saasConfig.storageDataSize || 10
          }
        }
      },

      security: {
        ssh: {
          enabled: true,
          customPort: saasConfig.sshPort || 2847,
          deploymentUser: saasConfig.deploymentUsername || 'deploy',
          authMethod: 'keys-only',
          disableRootLogin: true,
          maxAuthTries: 3
        },
        firewall: {
          enabled: true,
          defaultIncoming: 'deny',
          allowedPorts: saasConfig.allowedPorts || [saasConfig.sshPort, 80, 443],
          sshPort: saasConfig.sshPort || 2847,
          enableLogging: true
        },
        intrusionPrevention: {
          enabled: saasConfig.enableFail2ban !== false,
          maxRetries: 5,
          banTime: 3600,
          findTime: 600,
          sshPort: saasConfig.sshPort || 2847
        },
        systemUpdates: {
          enabled: saasConfig.enableAutoUpdates !== false,
          frequency: 'daily',
          autoReboot: false,
          rebootTime: '02:00'
        },
        emergencyAccess: {
          enableSSMAccess: true,
          createEmergencyUser: true,
          emergencyUsername: 'focal-emergency'
        }
      },

      sslConfig: saasConfig.enableSsl ? {
        enabled: true,
        provider: 'letsencrypt',
        email: saasConfig.sslEmail,
        challengeType: saasConfig.sslChallengeType || 'dns-01',
        domains: saasConfig.domains || [],
        useStaging: saasConfig.sslUseStaging || false
      } : {
        enabled: false,
        provider: 'manual'
      },

      dnsConfig: (saasConfig.domains && saasConfig.domains.length > 0 && credentials.dns) ? {
        enabled: true,
        provider: credentials.dns.provider,
        primaryDomain: saasConfig.primaryDomain || saasConfig.domains[0],
        domains: saasConfig.domains,
        credentials: credentials.dns
      } : {
        enabled: false
      },

      repository: saasConfig.githubRepo ? {
        url: saasConfig.githubRepo,
        branch: saasConfig.githubBranch || 'main'
      } : {},

      environment: this.buildEnvironmentVars(saasConfig.envVars || [])
    };
  }

  /**
   * Map SaaS OS value to CLI value
   */
  mapOSValue(osValue) {
    if (!osValue) return 'ubuntu';

    // Map 'ubuntu-22.04' -> 'ubuntu', 'debian' -> 'debian'
    if (osValue.startsWith('ubuntu')) return 'ubuntu';
    if (osValue.startsWith('debian')) return 'debian';
    return 'ubuntu'; // default
  }

  /**
   * Build environment variables object
   */
  buildEnvironmentVars(envVars) {
    const env = {};
    envVars.forEach(({ key, value }) => {
      if (key) env[key] = value;
    });
    return env;
  }
}

module.exports = { DeploymentBridge };
```

**Priority:** CRITICAL - This is the key fix

---

### Phase 4: Update Deployment Worker ⏳

**File:** `saas-server/services/deploymentWorker.js`

**Current:**
- Calls EC2 APIs directly
- Tries to allocate Elastic IPs
- Manual security group creation
- No S3 bucket creation

**New:**
```javascript
const { DeploymentBridge } = require('./deploymentBridge');

async function deployApplication(deployment, userId) {
  const bridge = new DeploymentBridge();

  try {
    // Log deployment started
    await updateDeploymentStatus(deployment.id, 'running');
    await logDeploymentEvent(deployment.id, 'Starting deployment using CLI executor');

    // Execute deployment through the CLI executor
    const result = await bridge.executeDeployment(
      deployment.id,
      deployment.configuration,
      userId
    );

    // Update deployment with results
    await deployment.update({
      status: 'completed',
      publicIp: result.phases.infrastructure.publicIpAddress,
      instanceId: result.phases.infrastructure.instanceId,
      sshPort: deployment.configuration.sshPort,
      deployedAt: new Date()
    });

    await logDeploymentEvent(deployment.id, 'Deployment completed successfully', result);

  } catch (error) {
    await deployment.update({
      status: 'failed',
      errorMessage: error.message
    });

    await logDeploymentEvent(deployment.id, `Deployment failed: ${error.message}`, error);
    throw error;
  }
}
```

**Priority:** CRITICAL - Must use bridge instead of direct EC2 calls

---

### Phase 5: Testing ⏳

1. **Test with Ubuntu deployment**
   - Verify S3 bucket created
   - Verify security group opens port 22 initially, then closes it
   - Verify custom SSH port works
   - Verify deployment user created

2. **Test with Debian deployment**
   - Verify default user is 'admin' not 'ubuntu'
   - Verify all features work same as Ubuntu

3. **Test with SSL enabled**
   - Verify Let's Encrypt certificate issued
   - Verify DNS-01 challenge works
   - Verify staging mode works

4. **Test error handling**
   - Test without AWS credentials
   - Test with invalid domain
   - Test with port 22 (should be rejected)

---

## Key Benefits

✅ **Uses tested CLI code** - No more improvisation
✅ **S3 bucket automatic** - Executor creates it
✅ **Proper security group** - Opens 22 first, closes after setup
✅ **No Elastic IPs** - Executor uses regular public IP
✅ **SSL support** - Full Let's Encrypt integration
✅ **Debian support** - Both Ubuntu and Debian work
✅ **Emergency access** - Automatic SSM setup

## Implementation Order

1. ✅ Document executor contract (DONE)
2. ⏳ Update SaaS form (2-3 hours)
3. ⏳ Create deployment bridge (1-2 hours)
4. ⏳ Update deployment worker (1 hour)
5. ⏳ Test everything (2-3 hours)

**Total Estimated Time:** 6-11 hours

## Ready to Proceed?

I can now implement these changes systematically. Should I:

A) Start with Phase 2 (form updates) - get all data collection working first
B) Start with Phase 3 (bridge) - core fix, then backfill form
C) Do both in parallel (form + bridge simultaneously)

Your call!
