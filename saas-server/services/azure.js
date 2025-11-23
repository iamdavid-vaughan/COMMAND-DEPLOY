/**
 * Azure Deployment Service - Handle Azure VM creation and management
 */

const { ClientSecretCredential } = require('@azure/identity');
const { ComputeManagementClient } = require('@azure/arm-compute');
const { NetworkManagementClient } = require('@azure/arm-network');
const { ResourceManagementClient } = require('@azure/arm-resources');
const logger = require('../utils/logger');

/**
 * Create Azure VM deployment with user's Azure credentials
 */
async function createDeployment(azureCredentials, deploymentConfig) {
  const {
    region = 'eastus',
    instanceType = 'Standard_B1s',
    projectName,
    domains = [],
    configuration = {},
  } = deploymentConfig;

  const { subscriptionId, tenantId, clientId, clientSecret, resourceGroup } = azureCredentials;

  // Create Azure credential
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  // Create Azure clients
  const computeClient = new ComputeManagementClient(credential, subscriptionId);
  const networkClient = new NetworkManagementClient(credential, subscriptionId);
  const resourceClient = new ResourceManagementClient(credential, subscriptionId);

  try {
    logger.info('Azure: Starting deployment', { projectName, region, instanceType });

    // Step 1: Verify credentials by checking subscription
    await verifyCredentials(credential, subscriptionId);
    logger.info('Azure: Verified Azure credentials', { subscriptionId });

    // Step 2: Create or use resource group
    const rgName = resourceGroup || `focal-deploy-${projectName}-rg`;
    await ensureResourceGroup(resourceClient, rgName, region);
    logger.info('Azure: Resource group ready', { resourceGroup: rgName });

    // Step 3: Create Virtual Network and Subnet
    const vnetName = `focal-deploy-${projectName}-vnet`;
    const subnetName = `focal-deploy-${projectName}-subnet`;
    const subnet = await createVirtualNetwork(networkClient, rgName, vnetName, subnetName, region);
    logger.info('Azure: Virtual network created', { vnet: vnetName });

    // Step 4: Create Network Security Group with rules
    const nsgName = `focal-deploy-${projectName}-nsg`;
    const nsg = await createNetworkSecurityGroup(networkClient, rgName, nsgName, region);
    logger.info('Azure: Network security group created', { nsg: nsgName });

    // Step 5: Create Public IP
    const publicIpName = `focal-deploy-${projectName}-ip`;
    const publicIp = await createPublicIP(networkClient, rgName, publicIpName, region);
    logger.info('Azure: Public IP allocated', { publicIp: publicIp.ipAddress });

    // Step 6: Create Network Interface
    const nicName = `focal-deploy-${projectName}-nic`;
    const nic = await createNetworkInterface(
      networkClient,
      rgName,
      nicName,
      subnet,
      publicIp,
      nsg,
      region
    );
    logger.info('Azure: Network interface created', { nic: nicName });

    // Step 7: Create Virtual Machine
    const vmName = `focal-deploy-${projectName}`;
    const customData = createCloudInitScript(projectName, configuration);
    const vm = await createVirtualMachine(
      computeClient,
      rgName,
      vmName,
      nic,
      instanceType,
      region,
      customData
    );
    logger.info('Azure: Virtual machine created', { vm: vmName });

    // Step 8: Wait for VM to be running and get public IP
    const vmDetails = await waitForVM(computeClient, networkClient, rgName, vmName, publicIpName);
    logger.info('Azure: VM is running', { vmName, publicIp: vmDetails.publicIp });

    return {
      success: true,
      vmId: vm.id,
      vmName: vmName,
      publicIp: vmDetails.publicIp,
      privateIp: vmDetails.privateIp,
      resourceGroup: rgName,
      region,
      nsgName,
      vnetName,
      message: 'Azure VM created successfully',
    };
  } catch (error) {
    logger.error('Azure: Deployment failed', {
      projectName,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Azure deployment failed: ${error.message}`);
  }
}

/**
 * Terminate Azure VM deployment
 */
async function terminateDeployment(azureCredentials, deploymentInfo) {
  const { region, vmName, resourceGroup } = deploymentInfo;
  const { subscriptionId, tenantId, clientId, clientSecret } = azureCredentials;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const computeClient = new ComputeManagementClient(credential, subscriptionId);

  try {
    logger.info('Azure: Terminating VM', { vmName, resourceGroup, region });

    // Delete VM (this will also deallocate resources)
    await computeClient.virtualMachines.beginDeleteAndWait(resourceGroup, vmName);
    logger.info('Azure: VM terminated', { vmName });

    // Note: Resource group and associated resources (NIC, NSG, VNet, Public IP)
    // can be cleaned up manually or via cleanup job

    return {
      success: true,
      message: 'VM terminated successfully',
    };
  } catch (error) {
    logger.error('Azure: Termination failed', {
      vmName,
      resourceGroup,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Azure termination failed: ${error.message}`);
  }
}

/**
 * Get Azure VM deployment status
 */
async function getDeploymentStatus(azureCredentials, deploymentInfo) {
  const { vmName, resourceGroup } = deploymentInfo;
  const { subscriptionId, tenantId, clientId, clientSecret } = azureCredentials;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const computeClient = new ComputeManagementClient(credential, subscriptionId);

  try {
    // Get VM instance view for status
    const vm = await computeClient.virtualMachines.get(resourceGroup, vmName, {
      expand: 'instanceView',
    });

    const instanceView = vm.instanceView;
    const statuses = instanceView?.statuses || [];

    // Find provisioning and power state
    const provisioningStatus = statuses.find((s) => s.code?.startsWith('ProvisioningState/'));
    const powerStatus = statuses.find((s) => s.code?.startsWith('PowerState/'));

    return {
      success: true,
      state: powerStatus?.displayStatus || 'Unknown', // VM running, VM stopped, etc.
      provisioningState: provisioningStatus?.displayStatus || 'Unknown',
      vmSize: vm.hardwareProfile?.vmSize,
      location: vm.location,
    };
  } catch (error) {
    logger.error('Azure: Status check failed', {
      vmName,
      resourceGroup,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to get VM status: ${error.message}`);
  }
}

/**
 * Verify Azure credentials by attempting to access subscription
 */
async function verifyCredentials(credential, subscriptionId) {
  try {
    const { SubscriptionClient } = require('@azure/arm-subscriptions');
    const subscriptionClient = new SubscriptionClient(credential);
    await subscriptionClient.subscriptions.get(subscriptionId);
    return true;
  } catch (error) {
    throw new Error('Invalid Azure credentials');
  }
}

/**
 * Create or ensure resource group exists
 */
async function ensureResourceGroup(resourceClient, resourceGroupName, location) {
  try {
    // Check if resource group exists
    const rgExists = await resourceClient.resourceGroups
      .checkExistence(resourceGroupName)
      .catch(() => false);

    if (rgExists) {
      return await resourceClient.resourceGroups.get(resourceGroupName);
    }

    // Create new resource group
    return await resourceClient.resourceGroups.createOrUpdate(resourceGroupName, {
      location,
      tags: {
        ManagedBy: 'FocalDeploy',
      },
    });
  } catch (error) {
    throw new Error(`Failed to create resource group: ${error.message}`);
  }
}

/**
 * Create Virtual Network and Subnet
 */
async function createVirtualNetwork(networkClient, resourceGroup, vnetName, subnetName, location) {
  try {
    // Create VNet
    const vnetParams = {
      location,
      addressSpace: {
        addressPrefixes: ['10.0.0.0/16'],
      },
      subnets: [
        {
          name: subnetName,
          addressPrefix: '10.0.1.0/24',
        },
      ],
      tags: {
        ManagedBy: 'FocalDeploy',
      },
    };

    const vnet = await networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
      resourceGroup,
      vnetName,
      vnetParams
    );

    // Return subnet reference
    return vnet.subnets[0];
  } catch (error) {
    throw new Error(`Failed to create virtual network: ${error.message}`);
  }
}

/**
 * Create Network Security Group with inbound rules
 */
async function createNetworkSecurityGroup(networkClient, resourceGroup, nsgName, location) {
  try {
    const nsgParams = {
      location,
      securityRules: [
        {
          name: 'Allow-SSH',
          priority: 1000,
          direction: 'Inbound',
          access: 'Allow',
          protocol: 'Tcp',
          sourcePortRange: '*',
          destinationPortRange: '22',
          sourceAddressPrefix: '*',
          destinationAddressPrefix: '*',
        },
        {
          name: 'Allow-HTTP',
          priority: 1001,
          direction: 'Inbound',
          access: 'Allow',
          protocol: 'Tcp',
          sourcePortRange: '*',
          destinationPortRange: '80',
          sourceAddressPrefix: '*',
          destinationAddressPrefix: '*',
        },
        {
          name: 'Allow-HTTPS',
          priority: 1002,
          direction: 'Inbound',
          access: 'Allow',
          protocol: 'Tcp',
          sourcePortRange: '*',
          destinationPortRange: '443',
          sourceAddressPrefix: '*',
          destinationAddressPrefix: '*',
        },
        {
          name: 'Allow-App-Port',
          priority: 1003,
          direction: 'Inbound',
          access: 'Allow',
          protocol: 'Tcp',
          sourcePortRange: '*',
          destinationPortRange: '3000',
          sourceAddressPrefix: '*',
          destinationAddressPrefix: '*',
        },
      ],
      tags: {
        ManagedBy: 'FocalDeploy',
      },
    };

    return await networkClient.networkSecurityGroups.beginCreateOrUpdateAndWait(
      resourceGroup,
      nsgName,
      nsgParams
    );
  } catch (error) {
    throw new Error(`Failed to create network security group: ${error.message}`);
  }
}

/**
 * Create Public IP address
 */
async function createPublicIP(networkClient, resourceGroup, publicIpName, location) {
  try {
    const publicIpParams = {
      location,
      publicIPAllocationMethod: 'Static',
      sku: {
        name: 'Standard',
      },
      tags: {
        ManagedBy: 'FocalDeploy',
      },
    };

    return await networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
      resourceGroup,
      publicIpName,
      publicIpParams
    );
  } catch (error) {
    throw new Error(`Failed to create public IP: ${error.message}`);
  }
}

/**
 * Create Network Interface
 */
async function createNetworkInterface(
  networkClient,
  resourceGroup,
  nicName,
  subnet,
  publicIp,
  nsg,
  location
) {
  try {
    const nicParams = {
      location,
      ipConfigurations: [
        {
          name: 'ipconfig1',
          subnet: {
            id: subnet.id,
          },
          publicIPAddress: {
            id: publicIp.id,
          },
          primary: true,
        },
      ],
      networkSecurityGroup: {
        id: nsg.id,
      },
      tags: {
        ManagedBy: 'FocalDeploy',
      },
    };

    return await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
      resourceGroup,
      nicName,
      nicParams
    );
  } catch (error) {
    throw new Error(`Failed to create network interface: ${error.message}`);
  }
}

/**
 * Create Virtual Machine
 */
async function createVirtualMachine(
  computeClient,
  resourceGroup,
  vmName,
  nic,
  vmSize,
  location,
  customData
) {
  try {
    const vmParams = {
      location,
      hardwareProfile: {
        vmSize: vmSize, // Standard_B1s, Standard_B2s, Standard_D2s_v3, etc.
      },
      storageProfile: {
        imageReference: {
          publisher: 'Canonical',
          offer: 'UbuntuServer',
          sku: '18.04-LTS',
          version: 'latest',
        },
        osDisk: {
          createOption: 'FromImage',
          managedDisk: {
            storageAccountType: 'Standard_LRS',
          },
        },
      },
      osProfile: {
        computerName: vmName,
        adminUsername: 'azureuser',
        adminPassword: generateSecurePassword(),
        customData: Buffer.from(customData).toString('base64'),
        linuxConfiguration: {
          disablePasswordAuthentication: false,
        },
      },
      networkProfile: {
        networkInterfaces: [
          {
            id: nic.id,
            primary: true,
          },
        ],
      },
      tags: {
        Name: vmName,
        ManagedBy: 'FocalDeploy',
      },
    };

    return await computeClient.virtualMachines.beginCreateOrUpdateAndWait(
      resourceGroup,
      vmName,
      vmParams
    );
  } catch (error) {
    throw new Error(`Failed to create virtual machine: ${error.message}`);
  }
}

/**
 * Wait for VM to be running and get IP addresses
 */
async function waitForVM(computeClient, networkClient, resourceGroup, vmName, publicIpName, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Get VM with instance view
      const vm = await computeClient.virtualMachines.get(resourceGroup, vmName, {
        expand: 'instanceView',
      });

      const instanceView = vm.instanceView;
      const statuses = instanceView?.statuses || [];
      const powerStatus = statuses.find((s) => s.code?.startsWith('PowerState/'));

      if (powerStatus?.code === 'PowerState/running') {
        // Get public IP address
        const publicIp = await networkClient.publicIPAddresses.get(resourceGroup, publicIpName);

        // Get private IP from network interface
        const nicId = vm.networkProfile?.networkInterfaces?.[0]?.id;
        const nicName = nicId?.split('/').pop();
        const nic = nicName
          ? await networkClient.networkInterfaces.get(resourceGroup, nicName)
          : null;

        const privateIp = nic?.ipConfigurations?.[0]?.privateIPAddress;

        return {
          state: 'running',
          publicIp: publicIp.ipAddress,
          privateIp: privateIp,
        };
      }

      // Wait 10 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error) {
      // Continue trying
    }
  }

  throw new Error('Timeout waiting for VM to be running');
}

/**
 * Create cloud-init script for VM initialization
 */
function createCloudInitScript(projectName, configuration) {
  const script = `#!/bin/bash
# Focal Deploy initialization script
# Project: ${projectName}

# Update system
apt-get update -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Git
apt-get install -y git

# Install PM2 globally
npm install -g pm2

# Install Nginx
apt-get install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create application directory
mkdir -p /var/www/${projectName}
cd /var/www/${projectName}

# Set permissions
chown -R azureuser:azureuser /var/www/${projectName}

# Log completion
echo "Focal Deploy initialization complete" > /var/log/focal-deploy-init.log
date >> /var/log/focal-deploy-init.log

# Additional custom configuration
${configuration.customScript || '# No custom script provided'}
`;

  return script;
}

/**
 * Generate secure random password for VM
 */
function generateSecurePassword() {
  const crypto = require('crypto');
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

module.exports = {
  createDeployment,
  terminateDeployment,
  getDeploymentStatus,
};
