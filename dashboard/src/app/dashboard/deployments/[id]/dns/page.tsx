/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Globe,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Shield,
  Clock
} from 'lucide-react';

interface DomainStatus {
  domain: string;
  resolved: boolean;
  addresses: string[];
  pointsToDeployment: boolean;
  expectedIp: string;
  ssl: {
    valid: boolean;
    daysUntilExpiry: number;
    expiresAt?: string;
  };
  status: 'configured' | 'misconfigured' | 'not_resolved' | 'error';
  error?: string;
}

interface DNSStatusResponse {
  success: boolean;
  domains: DomainStatus[];
  deploymentIp: string;
  message?: string;
}

interface SyncResult {
  domain: string;
  success: boolean;
  changeId?: string;
  status?: string;
  error?: string;
}

interface VerifyResult {
  domain: string;
  propagated: boolean;
  currentIp: string | null;
  expectedIp: string;
  allAddresses?: string[];
  error?: string;
}

export default function DNSManagementPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainStatus[]>([]);
  const [deploymentIp, setDeploymentIp] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [verifyResults, setVerifyResults] = useState<VerifyResult[] | null>(null);

  useEffect(() => {
    fetchDNSStatus();
  }, [deploymentId]);

  const fetchDNSStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dns/${deploymentId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data: DNSStatusResponse = await response.json();

      if (data.success) {
        setDomains(data.domains);
        setDeploymentIp(data.deploymentIp);
      } else {
        alert(data.message || 'Failed to fetch DNS status');
      }
    } catch (error) {
      console.error('Failed to fetch DNS status:', error);
      alert('Failed to fetch DNS status');
    } finally {
      setLoading(false);
    }
  };

  const syncDNS = async () => {
    if (!confirm('Sync all DNS records to point to this deployment?')) return;

    setSyncing(true);
    setSyncResults(null);

    try {
      const response = await fetch(`/api/dns/${deploymentId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSyncResults(data.results);
        // Refresh DNS status after sync
        setTimeout(() => fetchDNSStatus(), 2000);
      } else {
        alert(data.message || 'Failed to sync DNS records');
      }
    } catch (error) {
      console.error('Failed to sync DNS:', error);
      alert('Failed to sync DNS records');
    } finally {
      setSyncing(false);
    }
  };

  const verifyDNS = async () => {
    setVerifying(true);
    setVerifyResults(null);

    try {
      const response = await fetch(`/api/dns/${deploymentId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setVerifyResults(data.results);
      } else {
        alert(data.message || 'Failed to verify DNS propagation');
      }
    } catch (error) {
      console.error('Failed to verify DNS:', error);
      alert('Failed to verify DNS propagation');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'configured':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'misconfigured':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'not_resolved':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Loader className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'configured':
        return 'Configured Correctly';
      case 'misconfigured':
        return 'Points to Wrong IP';
      case 'not_resolved':
        return 'Not Resolved';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'misconfigured':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'not_resolved':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <Globe className="w-8 h-8 mr-3 text-blue-600" />
              DNS Management
            </h1>
            <p className="text-gray-600 mt-1">Manage domain DNS records for this deployment</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchDNSStatus}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Deployment IP Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-sm text-blue-600 font-semibold">Deployment Public IP</div>
            <div className="text-lg font-mono font-bold text-blue-900">{deploymentIp}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={syncDNS}
            disabled={syncing || domains.length === 0}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing DNS...' : 'Sync All DNS Records'}
          </button>
          <button
            onClick={verifyDNS}
            disabled={verifying || domains.length === 0}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className={`w-4 h-4 mr-2 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? 'Verifying...' : 'Verify DNS Propagation'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Sync: Updates Route53 A records to point to deployment IP<br />
          Verify: Checks if DNS has propagated correctly
        </p>
      </div>

      {/* Domain Status List */}
      {domains.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Configured Domains</h2>
          {domains.map((domain) => (
            <div
              key={domain.domain}
              className={`rounded-lg shadow-sm border-2 p-6 ${getStatusColor(domain.status)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(domain.status)}
                  <div>
                    <h3 className="text-lg font-bold">{domain.domain}</h3>
                    <p className="text-sm font-semibold">{getStatusText(domain.status)}</p>
                  </div>
                </div>
                {domain.ssl.valid && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-white rounded-lg border">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">SSL Valid</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-600 mb-1">DNS Resolution</div>
                  <div className="flex items-center space-x-2">
                    {domain.resolved ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm font-semibold">
                      {domain.resolved ? 'Resolved' : 'Not Resolved'}
                    </span>
                  </div>
                  {domain.addresses.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-600">Current IPs:</div>
                      {domain.addresses.map((ip) => (
                        <div key={ip} className="text-xs font-mono bg-gray-50 px-2 py-1 rounded mt-1">
                          {ip}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-600 mb-1">Points to Deployment</div>
                  <div className="flex items-center space-x-2">
                    {domain.pointsToDeployment ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-sm font-semibold">
                      {domain.pointsToDeployment ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-gray-600">Expected IP:</div>
                    <div className="text-xs font-mono bg-gray-50 px-2 py-1 rounded mt-1">
                      {domain.expectedIp}
                    </div>
                  </div>
                </div>

                {domain.ssl.valid && (
                  <div className="bg-white rounded-lg p-3 border col-span-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">SSL Certificate</div>
                        <div className="flex items-center space-x-2">
                          <Shield className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-600">Valid</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600 mb-1">Expires</div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-semibold">
                            {domain.ssl.daysUntilExpiry} days
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {domain.error && (
                  <div className="bg-white rounded-lg p-3 border border-red-300 col-span-full">
                    <div className="text-xs text-red-600 font-semibold mb-1">Error</div>
                    <div className="text-sm text-red-700">{domain.error}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">No domains configured for this deployment.</p>
        </div>
      )}

      {/* Sync Results */}
      {syncResults && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Sync Results</h2>
          <div className="space-y-3">
            {syncResults.map((result) => (
              <div
                key={result.domain}
                className={`p-4 rounded-lg border-2 ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{result.domain}</div>
                    {result.success ? (
                      <div className="text-sm text-green-700 mt-1">
                        DNS record updated successfully
                        {result.changeId && (
                          <div className="text-xs font-mono mt-1">Change ID: {result.changeId}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-red-700 mt-1">{result.error}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verify Results */}
      {verifyResults && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">DNS Propagation Status</h2>
          <div className="space-y-3">
            {verifyResults.map((result) => (
              <div
                key={result.domain}
                className={`p-4 rounded-lg border-2 ${
                  result.propagated
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {result.propagated ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold">{result.domain}</div>
                    <div className={`text-sm mt-1 ${
                      result.propagated ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {result.propagated
                        ? 'DNS has propagated correctly'
                        : 'DNS has not fully propagated yet'}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Current IP:</span>
                        <span className="ml-2 font-mono">{result.currentIp || 'Not resolved'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Expected IP:</span>
                        <span className="ml-2 font-mono">{result.expectedIp}</span>
                      </div>
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-600 mt-2">{result.error}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
