# Google Cloud Platform (GCP) Deployment Integration Plan

## Overview
Extend Focal Deploy to support Google Cloud Platform alongside AWS, enabling users to deploy applications to both cloud providers through a unified interface.

## GCP Services Equivalent to AWS

### Compute
- **AWS EC2** → **GCP Compute Engine** (Virtual machines)
  - Instance types: e2, n1, n2, c2, m1 series
  - Similar: SSH access, custom machine types, preemptible instances (like spot instances)

### Storage
- **AWS S3** → **GCP Cloud Storage**
  - Buckets with similar permissions model
  - Storage classes: Standard, Nearline, Coldline, Archive
  - Signed URLs for temporary access

### Networking
- **AWS Security Groups** → **GCP Firewall Rules**
  - VPC-level rules instead of instance-level
  - Similar allow/deny rules for ingress/egress

- **AWS VPC** → **GCP Virtual Private Cloud (VPC)**
  - Auto-mode or custom subnets
  - Global VPC by default (vs regional in AWS)

### Container Registry
- **AWS ECR** → **GCP Artifact Registry / Container Registry**
  - Docker image storage
  - Similar authentication with service accounts

### Load Balancing
- **AWS Application Load Balancer** → **GCP HTTP(S) Load Balancer**
  - Global load balancing
  - SSL termination

### DNS
- **AWS Route53** → **GCP Cloud DNS**
  - Managed DNS service
  - Similar record types and management

### Identity & Access
- **AWS IAM** → **GCP IAM**
  - Service accounts (like IAM roles)
  - Fine-grained permissions

## Implementation Plan

### Phase 1: Core GCP Integration (Week 1-2)

#### 1.1 Authentication & Credentials
```javascript
// lib/gcp/auth.js
class GCPAuth {
  constructor() {
    this.credentials = null;
  }

  async authenticate(serviceAccountKey) {
    // Service account JSON key file authentication
    const { GoogleAuth } = require('google-auth-library');
    this.auth = new GoogleAuth({
      credentials: serviceAccountKey,
      scopes: [
        'https://www.googleapis.com/auth/compute',
        'https://www.googleapis.com/auth/devstorage.full_control'
      ]
    });
  }

  async getClient() {
    return await this.auth.getClient();
  }
}
```

**Key Differences:**
- Service Account JSON keys instead of Access Key/Secret Key
- Project-based organization (must specify project ID)
- OAuth2 scopes for API access

#### 1.2 Compute Engine Management
```javascript
// lib/gcp/compute-engine.js
const compute = require('@google-cloud/compute');

class ComputeEngineService {
  async createInstance(config) {
    const computeClient = new compute.InstancesClient();

    const instance = {
      name: config.name,
      machineType: `zones/${config.zone}/machineTypes/${config.machineType}`, // e.g., 'e2-medium'
      disks: [{
        initializeParams: {
          diskSizeGb: config.diskSize || 20,
          sourceImage: config.image || 'projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20231101'
        },
        boot: true,
        autoDelete: true
      }],
      networkInterfaces: [{
        accessConfigs: [{
          name: 'External NAT',
          type: 'ONE_TO_ONE_NAT'
        }]
      }],
      metadata: {
        items: [{
          key: 'ssh-keys',
          value: `${config.sshUsername}:${config.sshPublicKey}`
        }]
      },
      tags: {
        items: config.tags || []
      }
    };

    const [operation] = await computeClient.insert({
      project: config.projectId,
      zone: config.zone,
      instanceResource: instance
    });

    // Wait for operation to complete
    await operation.promise();

    return await this.getInstance(config.projectId, config.zone, config.name);
  }

  async getInstance(projectId, zone, name) {
    const computeClient = new compute.InstancesClient();
    const [instance] = await computeClient.get({
      project: projectId,
      zone: zone,
      instance: name
    });
    return instance;
  }

  async stopInstance(projectId, zone, name) {
    const computeClient = new compute.InstancesClient();
    const [operation] = await computeClient.stop({
      project: projectId,
      zone: zone,
      instance: name
    });
    await operation.promise();
  }

  async deleteInstance(projectId, zone, name) {
    const computeClient = new compute.InstancesClient();
    const [operation] = await computeClient.delete({
      project: projectId,
      zone: zone,
      instance: name
    });
    await operation.promise();
  }
}
```

**Key Differences:**
- Zones required for all operations (e.g., 'us-central1-a')
- Machine types use different naming: e2-medium, n1-standard-1
- SSH keys added via metadata
- Static IPs managed separately

#### 1.3 Cloud Storage Management
```javascript
// lib/gcp/cloud-storage.js
const { Storage } = require('@google-cloud/storage');

class CloudStorageService {
  constructor(credentials) {
    this.storage = new Storage({
      credentials: credentials,
      projectId: credentials.project_id
    });
  }

  async createBucket(bucketName, location = 'US') {
    const [bucket] = await this.storage.createBucket(bucketName, {
      location: location,
      storageClass: 'STANDARD',
      uniformBucketLevelAccess: {
        enabled: true
      }
    });
    return bucket;
  }

  async uploadFile(bucketName, localPath, destinationPath) {
    const bucket = this.storage.bucket(bucketName);
    await bucket.upload(localPath, {
      destination: destinationPath
    });
  }

  async makePublic(bucketName, fileName) {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.makePublic();
  }

  async deleteBucket(bucketName) {
    const bucket = this.storage.bucket(bucketName);
    await bucket.deleteFiles();
    await bucket.delete();
  }
}
```

#### 1.4 Firewall Rules (Security Groups equivalent)
```javascript
// lib/gcp/firewall.js
const compute = require('@google-cloud/compute');

class FirewallService {
  async createFirewallRule(projectId, ruleName, config) {
    const firewallsClient = new compute.FirewallsClient();

    const firewallRule = {
      name: ruleName,
      network: `projects/${projectId}/global/networks/default`,
      direction: config.direction || 'INGRESS',
      priority: config.priority || 1000,
      sourceRanges: config.sourceRanges || ['0.0.0.0/0'],
      allowed: config.allowed || [{
        IPProtocol: 'tcp',
        ports: ['80', '443']
      }],
      targetTags: config.targetTags || []
    };

    const [operation] = await firewallsClient.insert({
      project: projectId,
      firewallResource: firewallRule
    });

    await operation.promise();
  }

  async deleteFirewallRule(projectId, ruleName) {
    const firewallsClient = new compute.FirewallsClient();
    const [operation] = await firewallsClient.delete({
      project: projectId,
      firewall: ruleName
    });
    await operation.promise();
  }
}
```

### Phase 2: Unified Deployment Interface (Week 3)

#### 2.1 Provider Abstraction Layer
```javascript
// lib/providers/cloud-provider.js
class CloudProvider {
  constructor(type, credentials) {
    this.type = type; // 'aws' or 'gcp'
    this.credentials = credentials;
  }

  async deploy(config) {
    if (this.type === 'aws') {
      return await this.deployToAWS(config);
    } else if (this.type === 'gcp') {
      return await this.deployToGCP(config);
    }
    throw new Error(`Unsupported provider: ${this.type}`);
  }

  async deployToAWS(config) {
    // Existing AWS deployment logic
  }

  async deployToGCP(config) {
    // 1. Create Compute Engine instance
    // 2. Create Cloud Storage bucket
    // 3. Configure firewall rules
    // 4. Deploy application
    // 5. Configure domain (Cloud DNS)
  }
}
```

#### 2.2 Configuration Schema
```yaml
# focal-deploy.yml
provider: gcp  # or 'aws'

gcp:
  projectId: my-project-123456
  region: us-central1
  zone: us-central1-a

  compute:
    machineType: e2-medium
    diskSize: 20
    image: ubuntu-2004-focal

  storage:
    bucketName: focal-deploy-my-app
    location: US

  network:
    allowedPorts:
      - 80
      - 443
      - 22

aws:
  region: us-east-1
  instanceType: t3.medium
  # ... existing AWS config
```

### Phase 3: Dashboard Integration (Week 4)

#### 3.1 Provider Selection UI
```typescript
// dashboard/src/components/ProviderSelector.tsx
export function ProviderSelector({ onSelect }: { onSelect: (provider: 'aws' | 'gcp') => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => onSelect('aws')}
        className="p-6 border-2 rounded-lg hover:border-blue-500"
      >
        <img src="/aws-logo.svg" className="h-12 mx-auto mb-4" />
        <h3 className="font-semibold">Amazon Web Services</h3>
        <p className="text-sm text-gray-600 mt-2">
          Deploy to EC2, S3, and more
        </p>
      </button>

      <button
        onClick={() => onSelect('gcp')}
        className="p-6 border-2 rounded-lg hover:border-blue-500"
      >
        <img src="/gcp-logo.svg" className="h-12 mx-auto mb-4" />
        <h3 className="font-semibold">Google Cloud Platform</h3>
        <p className="text-sm text-gray-600 mt-2">
          Deploy to Compute Engine, Cloud Storage
        </p>
      </button>
    </div>
  );
}
```

#### 3.2 GCP Credential Input
```typescript
// dashboard/src/components/GCPCredentialForm.tsx
export function GCPCredentialForm() {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Project ID *
        </label>
        <input
          type="text"
          placeholder="my-project-123456"
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Service Account Key *
        </label>
        <textarea
          placeholder="Paste your service account JSON key here"
          rows={6}
          className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Create a service account with Compute Engine and Storage permissions
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Region
        </label>
        <select className="w-full px-4 py-2 border rounded-lg">
          <option value="us-central1">us-central1 (Iowa)</option>
          <option value="us-east1">us-east1 (South Carolina)</option>
          <option value="us-west1">us-west1 (Oregon)</option>
          <option value="europe-west1">europe-west1 (Belgium)</option>
          <option value="asia-east1">asia-east1 (Taiwan)</option>
        </select>
      </div>
    </div>
  );
}
```

### Phase 4: Backend API Updates (Week 4)

#### 4.1 Deployment Routes Enhancement
```javascript
// saas-server/routes/deployments.js
router.post('/deploy', authenticate, async (req, res) => {
  const { provider, config } = req.body;

  if (provider === 'gcp') {
    // Validate GCP credentials
    const gcpCredentials = await getGCPCredentials(req.user.userId);

    // Create deployment worker for GCP
    const deployment = await deployToGCP(config, gcpCredentials);

    return res.json({
      success: true,
      deployment: deployment
    });
  }

  // Existing AWS deployment logic
  // ...
});
```

## Cost Comparison

### GCP Advantages
- **Free Tier**: $300 credit for 90 days
- **Sustained Use Discounts**: Automatic discounts for running VMs
- **Per-second Billing**: More granular than AWS per-minute
- **Preemptible VMs**: Up to 80% cheaper than regular instances

### Equivalent Pricing (Monthly Estimates)
| Service | AWS | GCP |
|---------|-----|-----|
| Small VM (2 vCPU, 4GB RAM) | t3.medium: ~$30 | e2-medium: ~$25 |
| Medium VM (4 vCPU, 16GB RAM) | t3.xlarge: ~$120 | e2-standard-4: ~$100 |
| 100GB Storage | S3: ~$2.30 | Cloud Storage: ~$2.00 |
| Load Balancer | ALB: ~$20 | HTTP LB: ~$18 |

## Migration Path

### For Existing Users
1. **Opt-in Beta**: Invite existing users to test GCP deployment
2. **Multi-Cloud Dashboard**: Show both AWS and GCP deployments
3. **Cost Calculator**: Help users compare costs between providers
4. **Migration Tool**: Easy transfer from AWS to GCP (and vice versa)

### For New Users
1. **Provider Choice**: Select during onboarding
2. **Multi-Provider**: Deploy to both simultaneously
3. **Geographic Optimization**: Recommend provider based on target audience

## Technical Requirements

### NPM Dependencies
```json
{
  "@google-cloud/compute": "^4.0.0",
  "@google-cloud/storage": "^7.0.0",
  "google-auth-library": "^9.0.0"
}
```

### Environment Variables
```env
# GCP Configuration
GCP_PROJECT_ID=focal-deploy-prod
GCP_REGION=us-central1
GCP_ZONE=us-central1-a
```

### Database Schema Updates
```sql
-- Add provider field to deployments table
ALTER TABLE deployments ADD COLUMN provider VARCHAR(10) DEFAULT 'aws';
ALTER TABLE deployments ADD COLUMN provider_region VARCHAR(50);
ALTER TABLE deployments ADD COLUMN provider_zone VARCHAR(50);

-- Add GCP credentials table
CREATE TABLE gcp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(100) NOT NULL,
  service_account_key JSONB NOT NULL, -- Encrypted
  region VARCHAR(50) DEFAULT 'us-central1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Testing Strategy

### Unit Tests
- GCP API client wrappers
- Provider abstraction layer
- Credential validation

### Integration Tests
- End-to-end deployment to GCP test project
- Multi-provider deployment scenarios
- Failover between providers

### Load Tests
- Concurrent deployments across both providers
- API rate limit handling
- Cost optimization validation

## Timeline

| Week | Tasks |
|------|-------|
| 1 | Core GCP service wrappers (Compute, Storage, Firewall) |
| 2 | Provider abstraction layer, unified config |
| 3 | Dashboard UI for provider selection |
| 4 | Backend API updates, testing |
| 5 | Beta release, documentation |
| 6 | Production rollout, monitoring |

## Success Metrics

1. **Adoption Rate**: 20% of new users choose GCP
2. **Multi-Cloud Usage**: 10% of users deploy to both providers
3. **Cost Savings**: Average 15% reduction in cloud costs
4. **Deployment Success**: 95%+ success rate on GCP
5. **Support Tickets**: <5% increase despite new feature

## Documentation Needed

1. **GCP Setup Guide**: Service account creation, API enablement
2. **Provider Comparison**: Help users choose
3. **Migration Guide**: Moving from AWS to GCP
4. **API Reference**: GCP-specific API endpoints
5. **Troubleshooting**: Common GCP issues

## Future Enhancements

### Phase 5+
- **Azure Support**: Add Microsoft Azure as third provider
- **Kubernetes**: GKE (GCP) and EKS (AWS) deployment
- **Serverless**: Cloud Functions (GCP) and Lambda (AWS)
- **Multi-Region**: Deploy to multiple regions simultaneously
- **Cost Optimization**: Automatic provider selection based on cost
- **Hybrid Cloud**: Deploy across multiple providers with load balancing

---

## Quick Start Implementation (MVP)

For a minimal viable product, focus on:

1. ✅ Compute Engine instance creation
2. ✅ Basic firewall rules (ports 80, 443, 22)
3. ✅ SSH key management
4. ✅ Provider selection in deployment wizard
5. ✅ GCP credentials storage (encrypted)

Skip for MVP:
- ❌ Cloud Storage (use instance storage initially)
- ❌ Load balancers (single instance only)
- ❌ Advanced networking (VPC customization)
- ❌ Cloud DNS (manual DNS setup)

This gets GCP support live faster while maintaining feature parity with AWS for core deployment functionality.
