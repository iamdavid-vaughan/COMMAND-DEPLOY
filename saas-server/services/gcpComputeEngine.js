/**
 * Google Cloud Platform Compute Engine Service
 * Handles VM instance creation, management, and deletion
 */

const { Compute } = require('@google-cloud/compute');
const crypto = require('crypto');
const { encryptData, decryptData } = require('./encryption');
const logger = require('../utils/logger');

class GCPComputeEngineService {
  constructor() {
    this.compute = null;
    this.projectId = null;
  }

  /**
   * Initialize with decrypted service account credentials
   */
  async initialize(encryptedCredentials, projectId) {
    try {
      // Decrypt the service account key
      const decryptedKey = decryptData(encryptedCredentials);
      const serviceAccountKey = JSON.parse(decryptedKey);

      this.projectId = projectId || serviceAccountKey.project_id;

      // Initialize Compute Engine client
      this.compute = new Compute({
        credentials: serviceAccountKey,
        projectId: this.projectId
      });

      logger.info('GCP: Initialized Compute Engine', { projectId: this.projectId });
      return true;
    } catch (error) {
      logger.error('GCP: Failed to initialize Compute Engine', { error: error.message, stack: error.stack });
      throw new Error(`GCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Create a new Compute Engine instance
   */
  async createInstance(config) {
    try {
      const zone = this.compute.zone(config.zone || 'us-central1-a');
      const instanceName = config.name || `focal-deploy-${Date.now()}`;

      // Machine type mapping (similar to AWS instance types)
      const machineType = this.getMachineType(config.instanceType || 'e2-medium');

      const vmConfig = {
        name: instanceName,
        machineType: machineType,

        // Boot disk configuration
        disks: [
          {
            boot: true,
            autoDelete: true,
            initializeParams: {
              diskSizeGb: config.diskSize || '20',
              sourceImage: config.image || 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts'
            }
          }
        ],

        // Network configuration with external IP
        networkInterfaces: [
          {
            network: 'global/networks/default',
            accessConfigs: [
              {
                name: 'External NAT',
                type: 'ONE_TO_ONE_NAT'
              }
            ]
          }
        ],

        // SSH keys and startup script
        metadata: {
          items: [
            {
              key: 'ssh-keys',
              value: `${config.sshUsername || 'ubuntu'}:${config.sshPublicKey}`
            },
            {
              key: 'startup-script',
              value: config.startupScript || this.getDefaultStartupScript()
            }
          ]
        },

        // Network tags for firewall rules
        tags: {
          items: config.tags || ['focal-deploy', 'http-server', 'https-server']
        },

        // Labels for organization
        labels: {
          'created-by': 'focal-deploy',
          'project': config.projectName?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'default',
          'environment': config.environment || 'production'
        }
      };

      logger.info('GCP: Creating instance', { instanceName, zone: config.zone, machineType });

      // Create the VM
      const [vm, operation] = await zone.createVM(instanceName, vmConfig);

      // Wait for creation to complete
      logger.info('GCP: Waiting for instance creation', { instanceName });
      await operation.promise();

      // Get instance details
      const [metadata] = await vm.getMetadata();

      const instanceInfo = {
        id: metadata.id,
        name: metadata.name,
        zone: config.zone,
        machineType: machineType,
        status: metadata.status,
        publicIp: this.extractPublicIP(metadata),
        privateIp: this.extractPrivateIP(metadata),
        selfLink: metadata.selfLink,
        createdAt: metadata.creationTimestamp
      };

      logger.info('GCP: Instance created successfully', {
        instanceName,
        publicIp: instanceInfo.publicIp,
        privateIp: instanceInfo.privateIp,
        zone: config.zone
      });

      return instanceInfo;

    } catch (error) {
      logger.error('GCP: Failed to create instance', { instanceName, error: error.message, stack: error.stack });
      throw new Error(`Failed to create GCP instance: ${error.message}`);
    }
  }

  /**
   * Get instance details
   */
  async getInstance(zone, instanceName) {
    try {
      const zoneObj = this.compute.zone(zone);
      const vm = zoneObj.vm(instanceName);
      const [metadata] = await vm.getMetadata();

      return {
        id: metadata.id,
        name: metadata.name,
        zone: zone,
        status: metadata.status,
        publicIp: this.extractPublicIP(metadata),
        privateIp: this.extractPrivateIP(metadata),
        machineType: metadata.machineType.split('/').pop()
      };
    } catch (error) {
      logger.error('GCP: Failed to get instance', { instanceName, zone, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Stop (shut down) an instance
   */
  async stopInstance(zone, instanceName) {
    try {
      const zoneObj = this.compute.zone(zone);
      const vm = zoneObj.vm(instanceName);

      logger.info('GCP: Stopping instance', { instanceName, zone });
      const [operation] = await vm.stop();
      await operation.promise();

      logger.info('GCP: Instance stopped', { instanceName, zone });
      return true;
    } catch (error) {
      logger.error('GCP: Failed to stop instance', { instanceName, zone, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Delete an instance
   */
  async deleteInstance(zone, instanceName) {
    try {
      const zoneObj = this.compute.zone(zone);
      const vm = zoneObj.vm(instanceName);

      logger.info('GCP: Deleting instance', { instanceName, zone });
      const [operation] = await vm.delete();
      await operation.promise();

      logger.info('GCP: Instance deleted', { instanceName, zone });
      return true;
    } catch (error) {
      logger.error('GCP: Failed to delete instance', { instanceName, zone, error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Create firewall rules for HTTP/HTTPS/SSH
   */
  async ensureFirewallRules() {
    try {
      const rules = [
        {
          name: 'focal-deploy-http',
          direction: 'INGRESS',
          priority: 1000,
          targetTags: ['http-server', 'focal-deploy'],
          allowed: [{ IPProtocol: 'tcp', ports: ['80'] }],
          sourceRanges: ['0.0.0.0/0']
        },
        {
          name: 'focal-deploy-https',
          direction: 'INGRESS',
          priority: 1000,
          targetTags: ['https-server', 'focal-deploy'],
          allowed: [{ IPProtocol: 'tcp', ports: ['443'] }],
          sourceRanges: ['0.0.0.0/0']
        },
        {
          name: 'focal-deploy-ssh',
          direction: 'INGRESS',
          priority: 1000,
          targetTags: ['focal-deploy'],
          allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
          sourceRanges: ['0.0.0.0/0']
        }
      ];

      for (const rule of rules) {
        try {
          const firewall = this.compute.firewall(rule.name);
          const [exists] = await firewall.exists();

          if (!exists) {
            logger.info('GCP: Creating firewall rule', { ruleName: rule.name });
            await this.compute.createFirewall(rule.name, {
              allowed: rule.allowed,
              sourceRanges: rule.sourceRanges,
              targetTags: rule.targetTags,
              direction: rule.direction,
              priority: rule.priority
            });
            logger.info('GCP: Firewall rule created', { ruleName: rule.name });
          } else {
            logger.info('GCP: Firewall rule already exists', { ruleName: rule.name });
          }
        } catch (error) {
          logger.warn('GCP: Could not create firewall rule', { ruleName: rule.name, error: error.message });
        }
      }

      return true;
    } catch (error) {
      logger.error('GCP: Failed to ensure firewall rules', { error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Helper: Extract public IP from metadata
   */
  extractPublicIP(metadata) {
    try {
      const accessConfigs = metadata.networkInterfaces?.[0]?.accessConfigs;
      return accessConfigs?.[0]?.natIP || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Extract private IP from metadata
   */
  extractPrivateIP(metadata) {
    try {
      return metadata.networkInterfaces?.[0]?.networkIP || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Map instance type to GCP machine type
   */
  getMachineType(instanceType) {
    const mapping = {
      // AWS t3 series → GCP e2 series
      't3.micro': 'e2-micro',
      't3.small': 'e2-small',
      't3.medium': 'e2-medium',
      't3.large': 'e2-standard-2',
      't3.xlarge': 'e2-standard-4',

      // AWS t3 series → GCP e2 high-mem
      't3.2xlarge': 'e2-standard-8',

      // Direct GCP types
      'e2-micro': 'e2-micro',
      'e2-small': 'e2-small',
      'e2-medium': 'e2-medium',
      'e2-standard-2': 'e2-standard-2',
      'e2-standard-4': 'e2-standard-4',
      'e2-standard-8': 'e2-standard-8',
      'n1-standard-1': 'n1-standard-1',
      'n1-standard-2': 'n1-standard-2',
      'n1-standard-4': 'n1-standard-4',
    };

    return mapping[instanceType] || 'e2-medium';
  }

  /**
   * Helper: Default startup script
   */
  getDefaultStartupScript() {
    return `#!/bin/bash
# Focal Deploy default startup script

# Update system
apt-get update -y

# Install basic tools
apt-get install -y curl wget git

# Install Docker
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Install Node.js (LTS)
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

echo "✅ Focal Deploy: System ready"
`;
  }
}

module.exports = GCPComputeEngineService;
