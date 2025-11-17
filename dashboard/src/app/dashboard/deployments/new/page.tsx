'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { deploymentsAPI } from '@/lib/api';
import {
  Rocket, ChevronRight, ChevronLeft, Server, Shield,
  GitBranch, Globe, CheckCircle, AlertCircle, X, Cloud
} from 'lucide-react';

// Wizard Steps
const STEPS = [
  { id: 1, name: 'Project', icon: Rocket },
  { id: 2, name: 'Server', icon: Server },
  { id: 3, name: 'Security', icon: Shield },
  { id: 4, name: 'Application', icon: GitBranch },
  { id: 5, name: 'Domain & SSL', icon: Globe },
  { id: 6, name: 'Review', icon: CheckCircle },
];

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

const GCP_REGIONS = [
  { value: 'us-central1', label: 'US Central (Iowa)' },
  { value: 'us-east1', label: 'US East (South Carolina)' },
  { value: 'us-west1', label: 'US West (Oregon)' },
  { value: 'us-west2', label: 'US West (Los Angeles)' },
  { value: 'europe-west1', label: 'Europe West (Belgium)' },
  { value: 'europe-west2', label: 'Europe West (London)' },
  { value: 'asia-southeast1', label: 'Asia Southeast (Singapore)' },
  { value: 'asia-northeast1', label: 'Asia Northeast (Tokyo)' },
];

const AWS_INSTANCE_TYPES = [
  { value: 't3.micro', label: 't3.micro - 1 vCPU, 1GB RAM (Free Tier)', cost: '$0/mo*' },
  { value: 't3.small', label: 't3.small - 2 vCPU, 2GB RAM', cost: '$15/mo' },
  { value: 't3.medium', label: 't3.medium - 2 vCPU, 4GB RAM', cost: '$30/mo' },
  { value: 't3.large', label: 't3.large - 2 vCPU, 8GB RAM', cost: '$60/mo' },
  { value: 'm5.large', label: 'm5.large - 2 vCPU, 8GB RAM', cost: '$70/mo' },
];

const GCP_MACHINE_TYPES = [
  { value: 'e2-micro', label: 'e2-micro - 0.25-2 vCPU, 1GB RAM (Free Tier)', cost: '$0/mo*' },
  { value: 'e2-small', label: 'e2-small - 0.5-2 vCPU, 2GB RAM', cost: '$13/mo' },
  { value: 'e2-medium', label: 'e2-medium - 1-2 vCPU, 4GB RAM', cost: '$27/mo' },
  { value: 'n1-standard-1', label: 'n1-standard-1 - 1 vCPU, 3.75GB RAM', cost: '$25/mo' },
  { value: 'n1-standard-2', label: 'n1-standard-2 - 2 vCPU, 7.5GB RAM', cost: '$50/mo' },
];

const OS_OPTIONS = [
  { value: 'ubuntu', label: 'Ubuntu 22.04 LTS', recommended: true },
  { value: 'debian', label: 'Debian 12 (Bookworm)' },
];

const APP_TYPES = [
  { value: 'nodejs', label: 'Node.js', ports: [3000, 8080] },
  { value: 'python', label: 'Python (Flask/Django)', ports: [5000, 8000] },
  { value: 'static', label: 'Static Site', ports: [80] },
  { value: 'docker', label: 'Docker Container', ports: [8080] },
];

export default function NewDeploymentWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wizard form data
  const [formData, setFormData] = useState({
    // Step 1: Project
    provider: 'aws' as 'aws' | 'gcp',
    projectName: '',
    region: 'us-east-1',
    instanceType: 't3.micro',

    // Step 2: Server
    operatingSystem: 'ubuntu',
    deploymentUsername: 'deploy',
    sshPort: 2847,
    storageRootSize: 20, // GB
    storageDataSize: 10, // GB

    // Step 3: Security
    enableSshHardening: true,
    enableFail2ban: true,
    enableAutoUpdates: true,
    enableFirewall: true,
    allowedPorts: [2847, 80, 443],

    // Step 4: Application
    applicationType: 'nodejs',
    githubRepo: '',
    githubBranch: 'main',
    applicationPort: 3000,
    envVars: [] as { key: string; value: string }[],

    // Step 5: Domain & SSL
    domains: [] as string[],
    primaryDomain: '',
    enableSsl: false,
    sslEmail: '',
    sslChallengeType: 'dns-01' as 'dns-01' | 'http-01',
    sslUseStaging: false,
  });

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        provider: formData.provider, // 'aws' or 'gcp'
        projectName: formData.projectName,
        region: formData.region,
        instanceType: formData.instanceType,
        operatingSystem: formData.operatingSystem,
        deploymentUsername: formData.deploymentUsername,
        sshPort: formData.sshPort,
        storageRootSize: formData.storageRootSize,
        storageDataSize: formData.storageDataSize,
        allowedPorts: formData.allowedPorts,
        enableSshHardening: formData.enableSshHardening,
        enableFail2ban: formData.enableFail2ban,
        enableAutoUpdates: formData.enableAutoUpdates,
        enableFirewall: formData.enableFirewall,
        applicationType: formData.applicationType,
        githubRepo: formData.githubRepo,
        githubBranch: formData.githubBranch,
        applicationPort: formData.applicationPort,
        envVars: formData.envVars,
        domains: formData.domains,
        primaryDomain: formData.primaryDomain,
        enableSsl: formData.enableSsl,
        sslEmail: formData.sslEmail,
        sslChallengeType: formData.sslChallengeType,
        sslUseStaging: formData.sslUseStaging,
      };

      await deploymentsAPI.create(payload);

      setMessage({
        type: 'success',
        text: 'Deployment created successfully! Redirecting to deployments...',
      });

      setTimeout(() => {
        router.push('/dashboard/deployments');
      }, 1500);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create deployment',
      });
      setLoading(false);
    }
  };

  const addEnvVar = () => {
    setFormData({
      ...formData,
      envVars: [...formData.envVars, { key: '', value: '' }],
    });
  };

  const removeEnvVar = (index: number) => {
    setFormData({
      ...formData,
      envVars: formData.envVars.filter((_, i) => i !== index),
    });
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...formData.envVars];
    newEnvVars[index][field] = value;
    setFormData({ ...formData, envVars: newEnvVars });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Rocket className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">New Deployment</h1>
        </div>
        <p className="text-gray-500">Complete deployment wizard with full server configuration</p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isActive
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : isCompleted
                        ? 'border-green-600 bg-green-50 text-green-600'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 mb-6 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-96">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Project Configuration</h2>

            {/* Cloud Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Cloud Provider <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      provider: 'aws',
                      region: 'us-east-1',
                      instanceType: 't3.micro'
                    });
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.provider === 'aws'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Cloud className={`w-6 h-6 ${formData.provider === 'aws' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${formData.provider === 'aws' ? 'text-blue-900' : 'text-gray-900'}`}>
                      Amazon AWS
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">EC2, S3, Free Tier available</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      provider: 'gcp',
                      region: 'us-central1',
                      instanceType: 'e2-micro'
                    });
                  }}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.provider === 'gcp'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Cloud className={`w-6 h-6 ${formData.provider === 'gcp' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${formData.provider === 'gcp' ? 'text-blue-900' : 'text-gray-900'}`}>
                      Google Cloud
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Compute Engine, Cloud Storage, Free Tier available</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="my-awesome-app"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Alphanumeric and hyphens only. Used for {formData.provider.toUpperCase()} resource naming.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.provider === 'aws' ? 'AWS Region' : 'GCP Region'}
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(formData.provider === 'aws' ? AWS_REGIONS : GCP_REGIONS).map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.provider === 'aws' ? 'Instance Type' : 'Machine Type'}
              </label>
              <div className="space-y-2">
                {(formData.provider === 'aws' ? AWS_INSTANCE_TYPES : GCP_MACHINE_TYPES).map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="instanceType"
                        value={type.value}
                        checked={formData.instanceType === type.value}
                        onChange={(e) => setFormData({ ...formData, instanceType: e.target.value })}
                        className="mr-3"
                      />
                      <span className="text-sm text-gray-900">{type.label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{type.cost}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">* Free tier: 750 hours/month for first 12 months</p>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Server Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Operating System</label>
              <div className="space-y-2">
                {OS_OPTIONS.map((os) => (
                  <label
                    key={os.value}
                    className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="os"
                      value={os.value}
                      checked={formData.operatingSystem === os.value}
                      onChange={(e) => setFormData({ ...formData, operatingSystem: e.target.value })}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-900">{os.label}</span>
                    {os.recommended && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        Recommended
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deployment Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.deploymentUsername}
                onChange={(e) => setFormData({ ...formData, deploymentUsername: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="deploy"
                pattern="[a-z][a-z0-9_-]*"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Custom deployment user (lowercase letters, numbers, hyphens, underscores only).
              </p>
              {['ubuntu', 'ec2-user', 'admin', 'root'].includes(formData.deploymentUsername) && (
                <p className="mt-1 text-sm text-red-600 font-medium">
                  ❌ Cannot use OS default usernames ('ubuntu', 'ec2-user', 'admin', 'root'). Choose a different name.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom SSH Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.sshPort}
                onChange={(e) => {
                  const port = parseInt(e.target.value);
                  setFormData({
                    ...formData,
                    sshPort: port,
                    allowedPorts: [port, 80, 443],
                  });
                }}
                placeholder="2847"
                min="1024"
                max="65535"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-amber-600 font-medium">
                ⚠️ IMPORTANT: Port 22 is NEVER used for security reasons. Port 22 will be automatically closed during deployment.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Recommended: 2847 (default). Must be between 1024-65535 and not a commonly used port.
              </p>
              {formData.sshPort === 22 && (
                <p className="mt-1 text-sm text-red-600 font-medium">
                  ❌ Port 22 is not allowed! Please use a custom port like 2847.
                </p>
              )}
              {[80, 443, 25, 53, 110, 143, 993, 995].includes(formData.sshPort) && (
                <p className="mt-1 text-sm text-yellow-600">
                  ⚠️ This port is commonly used by other services. Consider using a different port.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Storage Configuration</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Root Volume (GB)</label>
                  <input
                    type="number"
                    value={formData.storageRootSize}
                    onChange={(e) => setFormData({ ...formData, storageRootSize: parseInt(e.target.value) })}
                    min="8"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Volume (GB)</label>
                  <input
                    type="number"
                    value={formData.storageDataSize}
                    onChange={(e) => setFormData({ ...formData, storageDataSize: parseInt(e.target.value) })}
                    min="10"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Root volume for OS and applications, data volume for application data. S3 bucket will be created automatically.
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Security Setup</h2>

            <div className="space-y-4">
              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.enableSshHardening}
                  onChange={(e) => setFormData({ ...formData, enableSshHardening: e.target.checked })}
                  className="mr-3 h-5 w-5"
                />
                <div>
                  <div className="font-medium text-gray-900">SSH Hardening</div>
                  <div className="text-sm text-gray-500">
                    Disable root login, password authentication, and configure secure SSH settings
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.enableFail2ban}
                  onChange={(e) => setFormData({ ...formData, enableFail2ban: e.target.checked })}
                  className="mr-3 h-5 w-5"
                />
                <div>
                  <div className="font-medium text-gray-900">Fail2ban Protection</div>
                  <div className="text-sm text-gray-500">
                    Automatically ban IPs with suspicious activity (brute force attempts)
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.enableAutoUpdates}
                  onChange={(e) => setFormData({ ...formData, enableAutoUpdates: e.target.checked })}
                  className="mr-3 h-5 w-5"
                />
                <div>
                  <div className="font-medium text-gray-900">Automatic Security Updates</div>
                  <div className="text-sm text-gray-500">
                    Enable unattended-upgrades for automatic security patches
                  </div>
                </div>
              </label>

              <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.enableFirewall}
                  onChange={(e) => setFormData({ ...formData, enableFirewall: e.target.checked })}
                  className="mr-3 h-5 w-5"
                />
                <div>
                  <div className="font-medium text-gray-900">UFW Firewall</div>
                  <div className="text-sm text-gray-500">
                    Configure uncomplicated firewall with only necessary ports open
                  </div>
                </div>
              </label>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Recommended:</strong> Enable all security features for production deployments.
                These significantly improve your server's security posture.
              </p>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Application Setup</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Application Type</label>
              <select
                value={formData.applicationType}
                onChange={(e) => {
                  const appType = APP_TYPES.find((t) => t.value === e.target.value);
                  setFormData({
                    ...formData,
                    applicationType: e.target.value,
                    applicationPort: appType?.ports[0] || 3000,
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {APP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Repository URL
              </label>
              <input
                type="url"
                value={formData.githubRepo}
                onChange={(e) => setFormData({ ...formData, githubRepo: e.target.value })}
                placeholder="https://github.com/username/repo.git"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Public repository URL. Private repos require SSH key configuration.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
              <input
                type="text"
                value={formData.githubBranch}
                onChange={(e) => setFormData({ ...formData, githubBranch: e.target.value })}
                placeholder="main"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Application Port</label>
              <input
                type="number"
                value={formData.applicationPort}
                onChange={(e) => setFormData({ ...formData, applicationPort: parseInt(e.target.value) })}
                placeholder="3000"
                min="1"
                max="65535"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Environment Variables (Optional)
              </label>
              <div className="space-y-2">
                {formData.envVars.map((envVar, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={envVar.key}
                      onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                      placeholder="KEY"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={envVar.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      placeholder="value"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeEnvVar(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Environment Variable
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Domain & SSL Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Domain (Optional)
              </label>
              <input
                type="text"
                value={formData.primaryDomain}
                onChange={(e) => {
                  const domain = e.target.value;
                  setFormData({
                    ...formData,
                    primaryDomain: domain,
                    domains: domain ? [domain, ...formData.domains.filter(d => d !== domain)] : formData.domains
                  });
                }}
                placeholder="example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                Main domain for your application. Nginx will be configured for this domain.
              </p>
            </div>

            {formData.primaryDomain && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Domains (Optional)
                </label>
                <div className="space-y-2">
                  {formData.domains.filter(d => d !== formData.primaryDomain).map((domain, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={domain}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          domains: formData.domains.filter((_, i) => formData.domains.indexOf(domain) !== i)
                        })}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newDomain = prompt('Enter additional domain (e.g., www.example.com):');
                      if (newDomain && !formData.domains.includes(newDomain)) {
                        setFormData({ ...formData, domains: [...formData.domains, newDomain] });
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Additional Domain
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Add subdomains or alternate domains (e.g., www.example.com, api.example.com)
                </p>
              </div>
            )}

            {formData.primaryDomain && (
              <>
                <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.enableSsl}
                    onChange={(e) => setFormData({ ...formData, enableSsl: e.target.checked })}
                    className="mr-3 h-5 w-5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Enable SSL Certificate</div>
                    <div className="text-sm text-gray-500">
                      Automatically obtain and configure free Let's Encrypt SSL certificate
                    </div>
                  </div>
                </label>

                {formData.enableSsl && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email for SSL Certificate <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.sslEmail}
                        onChange={(e) => setFormData({ ...formData, sslEmail: e.target.value })}
                        placeholder="admin@example.com"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Required by Let's Encrypt for certificate expiration notifications
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Challenge Type
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input
                            type="radio"
                            name="challengeType"
                            value="dns-01"
                            checked={formData.sslChallengeType === 'dns-01'}
                            onChange={(e) => setFormData({ ...formData, sslChallengeType: 'dns-01' })}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">DNS-01 Challenge</div>
                            <div className="text-xs text-gray-500">Requires DNS API access. Supports wildcards.</div>
                          </div>
                        </label>
                        <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input
                            type="radio"
                            name="challengeType"
                            value="http-01"
                            checked={formData.sslChallengeType === 'http-01'}
                            onChange={(e) => setFormData({ ...formData, sslChallengeType: 'http-01' })}
                            className="mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">HTTP-01 Challenge</div>
                            <div className="text-xs text-gray-500">Simpler, but requires port 80 accessible.</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.sslUseStaging}
                        onChange={(e) => setFormData({ ...formData, sslUseStaging: e.target.checked })}
                        className="mr-3 h-5 w-5"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Use Staging Mode</div>
                        <div className="text-xs text-gray-500">
                          Test SSL setup with Let's Encrypt staging servers (recommended for first deployment)
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </>
            )}

            {!formData.primaryDomain && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  No custom domain configured. Your application will be accessible via the EC2 instance's
                  public IP address. You can add a domain later through the deployment settings.
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Review & Deploy</h2>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Project</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Name:</dt>
                    <dd className="text-gray-900 font-medium">{formData.projectName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Region:</dt>
                    <dd className="text-gray-900">{AWS_REGIONS.find(r => r.value === formData.region)?.label}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Instance:</dt>
                    <dd className="text-gray-900">{formData.instanceType}</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Server</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">OS:</dt>
                    <dd className="text-gray-900">{OS_OPTIONS.find(os => os.value === formData.operatingSystem)?.label}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Deployment User:</dt>
                    <dd className="text-gray-900 font-mono">{formData.deploymentUsername}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Custom SSH Port:</dt>
                    <dd className="text-gray-900 font-mono">{formData.sshPort}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Storage:</dt>
                    <dd className="text-gray-900">{formData.storageRootSize}GB root / {formData.storageDataSize}GB data</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Security</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {formData.enableSshHardening ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                    <span className={formData.enableSshHardening ? 'text-gray-900' : 'text-gray-500'}>SSH Hardening</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.enableFail2ban ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                    <span className={formData.enableFail2ban ? 'text-gray-900' : 'text-gray-500'}>Fail2ban</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.enableAutoUpdates ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                    <span className={formData.enableAutoUpdates ? 'text-gray-900' : 'text-gray-500'}>Auto Updates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formData.enableFirewall ? <CheckCircle className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
                    <span className={formData.enableFirewall ? 'text-gray-900' : 'text-gray-500'}>Firewall</span>
                  </div>
                </div>
              </div>

              {formData.githubRepo && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Application</h3>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Type:</dt>
                      <dd className="text-gray-900">{APP_TYPES.find(t => t.value === formData.applicationType)?.label}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Repository:</dt>
                      <dd className="text-gray-900 truncate max-w-xs">{formData.githubRepo}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Branch:</dt>
                      <dd className="text-gray-900">{formData.githubBranch}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Port:</dt>
                      <dd className="text-gray-900">{formData.applicationPort}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {formData.primaryDomain && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Domain & SSL</h3>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Primary Domain:</dt>
                      <dd className="text-gray-900">{formData.primaryDomain}</dd>
                    </div>
                    {formData.domains.length > 1 && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Additional Domains:</dt>
                        <dd className="text-gray-900">{formData.domains.filter(d => d !== formData.primaryDomain).join(', ')}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-600">SSL:</dt>
                      <dd className="text-gray-900">{formData.enableSsl ? 'Enabled (Let\'s Encrypt)' : 'Disabled'}</dd>
                    </div>
                    {formData.enableSsl && (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">SSL Challenge:</dt>
                          <dd className="text-gray-900">{formData.sslChallengeType.toUpperCase()}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">SSL Mode:</dt>
                          <dd className="text-gray-900">{formData.sslUseStaging ? 'Staging (Test)' : 'Production'}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Make sure you have added your AWS credentials in the Credentials section.
                The deployment will fail without valid AWS credentials.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => router.push('/dashboard/deployments')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>

        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNext}
              disabled={!formData.projectName}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.projectName}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Deploy Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
