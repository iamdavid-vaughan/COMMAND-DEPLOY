'use client';

import { useEffect, useState } from 'react';
import { credentialsAPI, gcpCredentialsAPI, azureCredentialsAPI } from '@/lib/api';
import {
  Key,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Shield,
  Cloud,
  Github,
} from 'lucide-react';

interface Credential {
  id: string;
  type: 'aws' | 'digitalocean' | 'cloudflare' | 'godaddy' | 'route53' | 'github' | 'gcp' | 'azure';
  metadata?: {
    name?: string;
    region?: string;
    account_id?: string;
  };
  projectId?: string;
  serviceAccountEmail?: string;
  subscriptionId?: string;
  tenantId?: string;
  clientId?: string;
  resourceGroup?: string;
  zone?: string;
  isDefault?: boolean;
  created_at: string;
  updated_at: string;
  createdAt?: string;
}

type CredentialFormData = {
  type: 'aws' | 'digitalocean' | 'cloudflare' | 'godaddy' | 'route53' | 'github' | 'gcp' | 'azure';
  name: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  token?: string;
  apiKey?: string;
  apiSecret?: string;
  region?: string;
  projectId?: string;
  serviceAccountKey?: string;
  subscriptionId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  resourceGroup?: string;
  zone?: string;
  isDefault?: boolean;
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<CredentialFormData>({
    type: 'aws',
    name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch credentials from all APIs
      const [standardCreds, gcpCreds, azureCreds] = await Promise.all([
        credentialsAPI.list().catch(() => ({ data: { credentials: [] } })),
        gcpCredentialsAPI.list().catch(() => ({ data: { credentials: [] } })),
        azureCredentialsAPI.list().catch(() => ({ data: { credentials: [] } }))
      ]);

      // Combine and normalize credentials
      const allCredentials = [
        ...(standardCreds.data.credentials || []).map((c: any) => ({
          id: c.id,
          type: c.type,
          metadata: c.metadata,
          created_at: c.createdAt || c.created_at,
          updated_at: c.updatedAt || c.updated_at
        })),
        ...(gcpCreds.data.credentials || []).map((c: any) => ({
          id: c.id,
          type: 'gcp' as const,
          projectId: c.projectId,
          serviceAccountEmail: c.serviceAccountEmail,
          metadata: {
            name: c.projectId
          },
          region: c.region,
          zone: c.zone,
          isDefault: c.isDefault,
          created_at: c.createdAt || c.created_at,
          createdAt: c.createdAt || c.created_at
        })),
        ...(azureCreds.data.credentials || []).map((c: any) => ({
          id: c.id,
          type: 'azure' as const,
          subscriptionId: c.subscriptionId,
          tenantId: c.tenantId,
          clientId: c.clientId,
          resourceGroup: c.resourceGroup,
          metadata: {
            name: c.subscriptionId
          },
          region: c.region,
          isDefault: c.isDefault,
          created_at: c.createdAt || c.created_at,
          createdAt: c.createdAt || c.created_at
        }))
      ];

      setCredentials(allCredentials);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch credentials:', err);
      setError(err.response?.data?.message || 'Failed to load credentials');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Handle GCP separately
      if (formData.type === 'gcp') {
        // Parse service account key JSON
        let serviceAccountKey;
        try {
          serviceAccountKey = JSON.parse(formData.serviceAccountKey || '{}');
        } catch (parseError) {
          setError('Invalid service account key JSON. Please paste a valid JSON key.');
          setSubmitting(false);
          return;
        }

        await gcpCredentialsAPI.create({
          projectId: formData.projectId || '',
          serviceAccountKey: serviceAccountKey,
          region: formData.region || 'us-central1',
          zone: formData.zone || 'us-central1-a',
          isDefault: formData.isDefault || false
        });
      } else if (formData.type === 'azure') {
        // Handle Azure separately
        await azureCredentialsAPI.create({
          subscriptionId: formData.subscriptionId || '',
          tenantId: formData.tenantId || '',
          clientId: formData.clientId || '',
          clientSecret: formData.clientSecret || '',
          resourceGroup: formData.resourceGroup,
          region: formData.region || 'eastus',
          isDefault: formData.isDefault || false
        });
      } else {
        // Handle standard credentials
        const credentialData: any = {};

        switch (formData.type) {
          case 'aws':
            credentialData.accessKeyId = formData.accessKeyId;
            credentialData.secretAccessKey = formData.secretAccessKey;
            credentialData.region = formData.region;
            break;
          case 'digitalocean':
            credentialData.apiToken = formData.token; // Backend expects 'apiToken'
            break;
          case 'cloudflare':
          case 'godaddy':
            credentialData.apiKey = formData.apiKey;
            credentialData.apiSecret = formData.apiSecret;
            break;
          case 'github':
            credentialData.token = formData.token;
            break;
        }

        await credentialsAPI.create({
          type: formData.type,
          data: credentialData,
          metadata: {
            name: formData.name,
            region: formData.region,
          },
        });
      }

      // Reset form and refresh list
      setFormData({ type: 'aws', name: '' });
      setShowAddForm(false);
      await fetchCredentials();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string, type: string) => {
    if (!confirm(`Are you sure you want to delete credential "${name}"?`)) {
      return;
    }

    try {
      // Use appropriate API based on type
      if (type === 'gcp') {
        await gcpCredentialsAPI.delete(id);
      } else if (type === 'azure') {
        await azureCredentialsAPI.delete(id);
      } else {
        await credentialsAPI.delete(id);
      }
      setCredentials(credentials.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete credential');
    }
  };

  const getCredentialIcon = (type: string) => {
    switch (type) {
      case 'aws':
        return <Cloud className="h-6 w-6 text-orange-500" />;
      case 'digitalocean':
        return <Cloud className="h-6 w-6 text-blue-500" />;
      case 'cloudflare':
        return <Cloud className="h-6 w-6 text-orange-400" />;
      case 'gcp':
        return <Cloud className="h-6 w-6 text-blue-600" />;
      case 'github':
        return <Github className="h-6 w-6 text-gray-900" />;
      default:
        return <Key className="h-6 w-6 text-gray-500" />;
    }
  };

  const getCredentialLabel = (type: string) => {
    const labels: Record<string, string> = {
      aws: 'AWS',
      digitalocean: 'DigitalOcean',
      cloudflare: 'Cloudflare',
      godaddy: 'GoDaddy',
      route53: 'Route53',
      github: 'GitHub',
      gcp: 'Google Cloud (GCP)',
      azure: 'Microsoft Azure',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Credentials</h1>
          <p className="mt-1 text-gray-500">
            Securely manage your cloud provider credentials
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Credential
        </button>
      </div>

      {/* Security notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Your credentials are encrypted
          </p>
          <p className="text-sm text-blue-700 mt-1">
            All credentials are encrypted with AES-256-GCM before storage. They are
            only decrypted when needed for deployments.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add credential form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add New Credential
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Credential Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as any,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="aws">AWS</option>
                <option value="digitalocean">DigitalOcean</option>
                <option value="cloudflare">Cloudflare</option>
                <option value="godaddy">GoDaddy</option>
                <option value="github">GitHub</option>
                <option value="gcp">Google Cloud (GCP)</option>
                <option value="azure">Microsoft Azure</option>
              </select>
            </div>

            {/* Name (not shown for GCP or Azure) */}
            {formData.type !== 'gcp' && formData.type !== 'azure' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credential Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="e.g., Production AWS Account"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* AWS Fields */}
            {formData.type === 'aws' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={formData.accessKeyId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, accessKeyId: e.target.value })
                    }
                    required
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={formData.secretAccessKey || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, secretAccessKey: e.target.value })
                    }
                    required
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Region (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.region || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    placeholder="us-east-1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* DigitalOcean Fields */}
            {formData.type === 'digitalocean' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Token
                </label>
                <input
                  type="password"
                  value={formData.token || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, token: e.target.value })
                  }
                  required
                  placeholder="dop_v1_..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>
            )}

            {/* Cloudflare/GoDaddy Fields */}
            {(formData.type === 'cloudflare' || formData.type === 'godaddy') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={formData.apiKey || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={formData.apiSecret || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </>
            )}

            {/* GitHub Fields */}
            {formData.type === 'github' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={formData.token || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, token: e.target.value })
                  }
                  required
                  placeholder="ghp_..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
              </div>
            )}

            {/* GCP Fields */}
            {formData.type === 'gcp' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project ID
                  </label>
                  <input
                    type="text"
                    value={formData.projectId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, projectId: e.target.value })
                    }
                    required
                    placeholder="my-project-id"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Account Key (JSON)
                  </label>
                  <textarea
                    value={formData.serviceAccountKey || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceAccountKey: e.target.value })
                    }
                    required
                    placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Paste the entire JSON key file from Google Cloud Console
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Region (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.region || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, region: e.target.value })
                      }
                      placeholder="us-central1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Zone (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.zone || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, zone: e.target.value })
                      }
                      placeholder="us-central1-a"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault || false}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-700">
                    Set as default GCP credentials
                  </label>
                </div>
              </>
            )}

            {/* Azure Fields */}
            {formData.type === 'azure' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription ID *
                  </label>
                  <input
                    type="text"
                    value={formData.subscriptionId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, subscriptionId: e.target.value })
                    }
                    required
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tenant ID *
                  </label>
                  <input
                    type="text"
                    value={formData.tenantId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, tenantId: e.target.value })
                    }
                    required
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client ID (Application ID) *
                  </label>
                  <input
                    type="text"
                    value={formData.clientId || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, clientId: e.target.value })
                    }
                    required
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Secret *
                  </label>
                  <input
                    type="password"
                    value={formData.clientSecret || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, clientSecret: e.target.value })
                    }
                    required
                    placeholder="Service Principal Client Secret"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Client secret from your Service Principal
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resource Group (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.resourceGroup || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, resourceGroup: e.target.value })
                    }
                    placeholder="my-resource-group"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Region
                  </label>
                  <select
                    value={formData.region || 'eastus'}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="eastus">East US</option>
                    <option value="eastus2">East US 2</option>
                    <option value="westus">West US</option>
                    <option value="westus2">West US 2</option>
                    <option value="centralus">Central US</option>
                    <option value="westeurope">West Europe</option>
                    <option value="northeurope">North Europe</option>
                    <option value="southeastasia">Southeast Asia</option>
                    <option value="eastasia">East Asia</option>
                  </select>
                </div>
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="azureIsDefault"
                    checked={formData.isDefault || false}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="azureIsDefault" className="ml-2 block text-sm text-gray-700">
                    Set as default Azure credentials
                  </label>
                </div>
              </>
            )}

            {/* Form actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Credential'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credentials list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {credentials.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No credentials stored yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500 font-medium"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add your first credential
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getCredentialIcon(credential.type)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {credential.metadata?.name || 'Unnamed Credential'}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {getCredentialLabel(credential.type)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span>ID: {credential.id.slice(0, 8)}...</span>
                        {credential.metadata?.region && (
                          <span>Region: {credential.metadata.region}</span>
                        )}
                        <span>
                          Added {new Date(credential.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        handleDelete(
                          credential.id,
                          credential.metadata?.name || credential.projectId || 'this credential',
                          credential.type
                        )
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
