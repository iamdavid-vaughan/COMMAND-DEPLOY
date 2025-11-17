# Deployment Executor Contract Documentation

## Overview
The `DeploymentExecutor` is the CLI's tested deployment engine. The SaaS should call this instead of improvising with direct EC2 API calls.

## Input: `stepData` Structure

```javascript
{
  credentials: {
    aws: {
      accessKeyId: string,
      secretAccessKey: string
    },
    github: {
      token: string
    },
    dns: {
      provider: 'cloudflare' | 'route53' | 'godaddy' | 'digitalocean',
      // provider-specific credentials
    }
  },

  project: {
    name: string,
    type: 'nodejs' | 'python' | 'static' | 'react-spa' | 'vue-spa' | 'nextjs',
    port: number,
    description?: string
  },

  infrastructure: {
    region: string,  // e.g., 'us-east-1'
    instanceType: string,  // e.g., 't3.micro'
    operatingSystem: 'ubuntu' | 'debian',  // ⚠️ CRITICAL: SaaS is missing this!
    storage: {
      s3: {
        bucketName?: string,  // auto-generated if not provided
        encryption: boolean,  // default true
        publicAccess: boolean  // default false
      },
      volumes: {
        root: number,  // GB, default 20
        data: number   // GB, default 10
      }
    }
  },

  security: {
    ssh: {
      enabled: boolean,  // default true
      customPort: number,  // ⚠️ CRITICAL: default 2847, NEVER 22
      deploymentUser: string,  // ⚠️ CRITICAL: NOT 'ubuntu', 'admin', 'ec2-user', 'root'
      authMethod: 'keys-only',
      disableRootLogin: boolean,  // default true
      maxAuthTries: number,  // default 3
      keyPairName?: string  // auto-generated if not provided
    },
    firewall: {
      enabled: boolean,  // default true
      defaultIncoming: 'deny',
      allowedPorts: number[],  // ⚠️ CRITICAL: [customPort, 80, 443]
      sshPort: number,  // same as ssh.customPort
      enableLogging: boolean  // default true
    },
    intrusionPrevention: {
      enabled: boolean,  // default true
      maxRetries: number,  // default 5
      banTime: number,  // seconds, default 3600
      findTime: number,  // seconds, default 600
      sshPort: number  // same as ssh.customPort
    },
    systemUpdates: {
      enabled: boolean,  // default true
      frequency: 'daily',
      autoReboot: boolean,  // default false
      rebootTime: '02:00'
    },
    emergencyAccess: {
      enableSSMAccess: boolean,  // default true
      createEmergencyUser: boolean,  // default true
      emergencyUsername: string  // default 'focal-emergency'
    }
  },

  sslConfig: {
    enabled: boolean,
    provider: 'letsencrypt' | 'manual',
    email?: string,  // required for letsencrypt
    challengeType?: 'dns-01' | 'http-01',  // required for letsencrypt
    domains?: string[],  // list of all domains for certificate
    useStaging?: boolean  // letsencrypt staging mode for testing
  },

  dnsConfig: {
    enabled: boolean,
    provider: string,  // matches credentials.dns.provider
    primaryDomain: string,
    subdomains?: string[],
    domains: string[],  // all domains including subdomains
    credentials: object  // from credentials.dns
  },

  repository: {
    url?: string,
    branch?: string,
    deployKey?: string
  },

  environment: {
    NODE_ENV?: string,
    // other env vars
  }
}
```

## Deployment Phases

The executor runs 5 phases in order:

### 1. Infrastructure Phase
- Calls `UpCommand.execute()` (focal-deploy up)
- Creates:
  - EC2 instance with specified OS
  - **S3 bucket** (auto-creates, SaaS is missing this!)
  - **Security group** with all ports including 22 initially
  - SSH keypair
- Returns: `{ instanceId, publicIpAddress, securityGroupId, s3BucketName, keyPath }`

### 2. Security Phase
- Hardens SSH (changes port from 22 to customPort)
- Creates deployment user
- Configures firewall (ufw)
- Sets up fail2ban
- **Removes port 22 from security group** (SaaS opens wrong ports!)
- Configures automatic updates

### 3. DNS Phase
- Configures DNS records via provider APIs
- Points domains to EC2 public IP

### 4. SSL Phase
- Sets up Let's Encrypt certificates
- Configures automatic renewal
- Uses DNS-01 or HTTP-01 challenge

### 5. Application Phase
- Clones git repository
- Installs dependencies
- Configures application
- Sets up PM2/systemd

## What the SaaS is Doing Wrong

1. ❌ **Not creating S3 bucket** - Executor creates this automatically
2. ❌ **Wrong security group** - Opens port 2847 from start, should open 22 first then close it
3. ❌ **Direct EC2 API calls** - Should call UpCommand instead
4. ❌ **Elastic IP error** - Executor doesn't use Elastic IPs at all
5. ❌ **Missing OS choice** - No Debian option in SaaS
6. ❌ **No SSL configuration** - Doesn't ask about Let's Encrypt
7. ❌ **No deployment username** - Doesn't collect custom username
8. ❌ **No SSH port config** - Doesn't collect custom SSH port

## How SaaS Should Work

```javascript
// SaaS Backend
const DeploymentExecutor = require('../../lib/wizard/deployment-executor');

async function executeDeployment(saasConfig, userId) {
  // 1. Get user's stored credentials
  const credentials = await getStoredCredentials(userId);

  // 2. Build CLI-compatible stepData
  const stepData = buildStepData(saasConfig, credentials);

  // 3. Create project directory
  const projectPath = await createProjectDirectory(saasConfig.projectName);

  // 4. Call the actual executor
  const executor = new DeploymentExecutor();
  const result = await executor.execute(projectPath, stepData);

  return result;
}

function buildStepData(saasConfig, credentials) {
  return {
    credentials: {
      aws: credentials.aws,
      github: credentials.github,
      dns: credentials.dns
    },
    project: {
      name: saasConfig.projectName,
      type: saasConfig.applicationType,
      port: saasConfig.applicationPort
    },
    infrastructure: {
      region: saasConfig.region,
      instanceType: saasConfig.instanceType,
      operatingSystem: saasConfig.operatingSystem,  // ubuntu or debian
      storage: {
        s3: { encryption: true, publicAccess: false },
        volumes: { root: 20, data: 10 }
      }
    },
    security: {
      ssh: {
        enabled: true,
        customPort: saasConfig.sshPort,  // from form
        deploymentUser: saasConfig.deploymentUsername,  // from form
        authMethod: 'keys-only',
        disableRootLogin: true,
        maxAuthTries: 3
      },
      firewall: {
        enabled: true,
        allowedPorts: [saasConfig.sshPort, 80, 443],  // includes custom SSH port
        sshPort: saasConfig.sshPort
      },
      // ... rest of security defaults
    },
    sslConfig: saasConfig.ssl?.enabled ? {
      enabled: true,
      provider: 'letsencrypt',
      email: saasConfig.ssl.email,
      challengeType: saasConfig.ssl.challengeType,
      domains: saasConfig.domains
    } : { enabled: false },
    dnsConfig: saasConfig.dns?.enabled ? {
      enabled: true,
      provider: credentials.dns.provider,
      primaryDomain: saasConfig.primaryDomain,
      domains: saasConfig.domains,
      credentials: credentials.dns
    } : { enabled: false }
  };
}
```

## Key Insights

1. **UpCommand handles everything** - EC2, S3, security groups, keypairs
2. **Port 22 is opened first** - Then closed after user is created
3. **S3 bucket is automatic** - No manual bucket creation needed
4. **No Elastic IPs** - Just uses EC2 public IP
5. **OS matters** - Default user differs (ubuntu vs admin)
6. **SSH port matters** - Must be collected upfront for security group

## Next Steps

1. Update SaaS form to collect all required fields
2. Create `deploymentBridge.js` to translate SaaS→CLI
3. Replace `deploymentWorker.js` logic with executor call
4. Test end-to-end
