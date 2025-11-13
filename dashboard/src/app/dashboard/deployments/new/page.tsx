'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { deploymentsAPI } from '@/lib/api';
import { Rocket, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';

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

const INSTANCE_TYPES = [
  { value: 't3.micro', label: 't3.micro (1 vCPU, 1GB RAM) - Free Tier Eligible' },
  { value: 't3.small', label: 't3.small (2 vCPU, 2GB RAM)' },
  { value: 't3.medium', label: 't3.medium (2 vCPU, 4GB RAM)' },
  { value: 't3.large', label: 't3.large (2 vCPU, 8GB RAM)' },
  { value: 'm5.large', label: 'm5.large (2 vCPU, 8GB RAM)' },
  { value: 'm5.xlarge', label: 'm5.xlarge (4 vCPU, 16GB RAM)' },
  { value: 'c5.large', label: 'c5.large (2 vCPU, 4GB RAM) - Compute Optimized' },
];

export default function NewDeploymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    projectName: '',
    region: 'us-east-1',
    instanceType: 't3.micro',
    domains: [''],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Filter out empty domains
      const domains = formData.domains.filter((d) => d.trim() !== '');

      const payload = {
        projectName: formData.projectName,
        region: formData.region,
        instanceType: formData.instanceType,
        domains: domains.length > 0 ? domains : undefined,
      };

      const response = await deploymentsAPI.create(payload);

      setMessage({
        type: 'success',
        text: 'Deployment created successfully! Redirecting...',
      });

      // Redirect to deployments list after 1.5 seconds
      setTimeout(() => {
        router.push('/dashboard/deployments');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create deployment:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create deployment',
      });
      setLoading(false);
    }
  };

  const handleAddDomain = () => {
    setFormData({
      ...formData,
      domains: [...formData.domains, ''],
    });
  };

  const handleRemoveDomain = (index: number) => {
    setFormData({
      ...formData,
      domains: formData.domains.filter((_, i) => i !== index),
    });
  };

  const handleDomainChange = (index: number, value: string) => {
    const newDomains = [...formData.domains];
    newDomains[index] = value;
    setFormData({
      ...formData,
      domains: newDomains,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Rocket className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">New Deployment</h1>
        </div>
        <p className="text-gray-500">
          Create a new EC2 deployment in your AWS account
        </p>
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
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Project Name */}
        <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="projectName"
            required
            value={formData.projectName}
            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            placeholder="my-awesome-app"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-sm text-gray-500">
            Used to identify your deployment and tag AWS resources
          </p>
        </div>

        {/* Region */}
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-2">
            AWS Region
          </label>
          <select
            id="region"
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {AWS_REGIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Choose the AWS region closest to your users
          </p>
        </div>

        {/* Instance Type */}
        <div>
          <label htmlFor="instanceType" className="block text-sm font-medium text-gray-700 mb-2">
            Instance Type
          </label>
          <select
            id="instanceType"
            value={formData.instanceType}
            onChange={(e) => setFormData({ ...formData, instanceType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {INSTANCE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            t3.micro is eligible for AWS Free Tier (750 hours/month)
          </p>
        </div>

        {/* Domains */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Domains (Optional)
          </label>
          <div className="space-y-2">
            {formData.domains.map((domain, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => handleDomainChange(index, e.target.value)}
                  placeholder="example.com"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {formData.domains.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddDomain}
              className="inline-flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Domain
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Custom domains to configure for your deployment
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push('/dashboard/deployments')}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Create Deployment
              </>
            )}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Before creating a deployment:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Make sure you've added your AWS credentials in the Credentials section</li>
              <li>Your AWS account will be charged for the EC2 resources created</li>
              <li>The deployment process typically takes 3-5 minutes</li>
              <li>You can monitor deployment progress in real-time from the deployments list</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
