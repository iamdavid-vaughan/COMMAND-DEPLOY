/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Key,
  Download,
  Copy,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Terminal,
  Eye,
  EyeOff
} from 'lucide-react';

interface SSHKeyInfo {
  deploymentId: number;
  keyName: string;
  fingerprint: string;
  createdAt: string;
  modifiedAt: string;
  size: number;
  sshCommand: string | null;
  port: number;
  username: string;
  publicIp: string | null;
}

export default function SSHKeysPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sshKey, setSSHKey] = useState<SSHKeyInfo | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    output?: string;
  } | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedPublicKey, setCopiedPublicKey] = useState(false);

  useEffect(() => {
    fetchSSHKeyInfo();
  }, [deploymentId]);

  const fetchSSHKeyInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ssh-keys/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSSHKey(data.sshKey);
      } else {
        alert(data.message || 'Failed to fetch SSH key information');
      }
    } catch (error) {
      console.error('Failed to fetch SSH key info:', error);
      alert('Failed to fetch SSH key information');
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicKey = async () => {
    try {
      const response = await fetch(`/api/ssh-keys/${deploymentId}/public`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setPublicKey(data.publicKey);
        setShowPublicKey(true);
      } else {
        alert(data.message || 'Failed to fetch public key');
      }
    } catch (error) {
      console.error('Failed to fetch public key:', error);
      alert('Failed to fetch public key');
    }
  };

  const testSSHConnection = async () => {
    if (!confirm('Test SSH connection to this deployment?')) return;

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const response = await fetch(`/api/ssh-keys/${deploymentId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setConnectionResult({
        success: data.success,
        message: data.message,
        output: data.output
      });
    } catch (error) {
      console.error('Failed to test SSH connection:', error);
      setConnectionResult({
        success: false,
        message: 'Failed to test SSH connection'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const downloadPrivateKey = () => {
    const token = localStorage.getItem('token');
    const url = `/api/ssh-keys/${deploymentId}/download`;

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = `${url}?token=${token}`;
    link.download = sshKey?.keyName || 'focal-deploy.pem';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async (text: string, type: 'command' | 'publicKey') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'command') {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      } else {
        setCopiedPublicKey(true);
        setTimeout(() => setCopiedPublicKey(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sshKey) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Key className="w-8 h-8 mr-3 text-blue-600" />
              SSH Key Management
            </h1>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">SSH key not found for this deployment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Key className="w-8 h-8 mr-3 text-blue-600" />
              SSH Key Management
            </h1>
            <p className="text-gray-600 mt-1">Manage SSH access to your deployment</p>
          </div>
        </div>
        <button
          onClick={fetchSSHKeyInfo}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* SSH Key Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">SSH Key Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Key Name</div>
            <div className="font-mono text-sm font-semibold">{sshKey.keyName}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">SSH Port</div>
            <div className="font-mono text-sm font-semibold">{sshKey.port}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Username</div>
            <div className="font-mono text-sm font-semibold">{sshKey.username}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Public IP</div>
            <div className="font-mono text-sm font-semibold">{sshKey.publicIp || 'Not available'}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg col-span-full">
            <div className="text-sm text-gray-600 mb-1">Fingerprint</div>
            <div className="font-mono text-xs break-all">{sshKey.fingerprint}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Created</div>
            <div className="text-sm">{new Date(sshKey.createdAt).toLocaleString()}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Modified</div>
            <div className="text-sm">{new Date(sshKey.modifiedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* SSH Command */}
      {sshKey.sshCommand && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Terminal className="w-5 h-5 mr-2" />
            SSH Connection Command
          </h2>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              {sshKey.sshCommand}
            </div>
            <button
              onClick={() => copyToClipboard(sshKey.sshCommand!, 'command')}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              title="Copy to clipboard"
            >
              {copiedCommand ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          {copiedCommand && (
            <p className="text-green-600 text-sm mt-2">Command copied to clipboard!</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={downloadPrivateKey}
            className="inline-flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Private Key
          </button>
          <button
            onClick={fetchPublicKey}
            className="inline-flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {showPublicKey ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPublicKey ? 'Hide' : 'View'} Public Key
          </button>
          <button
            onClick={testSSHConnection}
            disabled={testingConnection || !sshKey.publicIp}
            className="inline-flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Terminal className="w-4 h-4 mr-2" />
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Public Key Display */}
      {showPublicKey && publicKey && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Public Key</h2>
            <button
              onClick={() => copyToClipboard(publicKey, 'publicKey')}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {copiedPublicKey ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copiedPublicKey ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto break-all">
            {publicKey}
          </div>
        </div>
      )}

      {/* Connection Test Result */}
      {connectionResult && (
        <div className={`rounded-lg shadow-sm border p-6 ${
          connectionResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {connectionResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${
                connectionResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {connectionResult.message}
              </h3>
              {connectionResult.output && (
                <pre className={`text-sm font-mono p-3 rounded ${
                  connectionResult.success ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {connectionResult.output}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
