'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Terminal,
  RefreshCw,
  ArrowLeft,
  Play,
  StopCircle,
  Copy,
  Key,
  Shield,
  Database,
  Trash2,
  Rocket,
  Download
} from 'lucide-react';
import { deploymentsAPI } from '@/lib/api';
import MetricsDashboard from '@/components/MetricsDashboard';

interface DeploymentLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  metadata?: any;
}

interface Deployment {
  id: string;
  projectName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'terminated' | 'cancelled';
  instanceId: string | null;
  region: string;
  instanceType: string;
  publicIp: string | null;
  domains: string[];
  configuration: any;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  connectionInfo?: {
    sshCommand: string | null;
    sshKeyPath: string | null;
    username: string;
    port: number;
    securityGroupId: string | null;
    securityGroupName: string | null;
    s3BucketName: string | null;
    keyPairName: string | null;
  } | null;
}

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [appControlLoading, setAppControlLoading] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch deployment details
  const fetchDeployment = async () => {
    try {
      const response = await deploymentsAPI.getById(deploymentId);
      setDeployment(response.data.deployment);

      // Disable auto-refresh if deployment is in terminal state
      if (['completed', 'failed', 'terminated', 'cancelled'].includes(response.data.deployment.status)) {
        setAutoRefresh(false);
      }
    } catch (err: any) {
      console.error('Failed to fetch deployment:', err);
      setError(err.response?.data?.message || 'Failed to load deployment');
    }
  };

  // Fetch deployment logs
  const fetchLogs = async () => {
    try {
      const response = await deploymentsAPI.getLogs(deploymentId);
      setLogs(response.data.logs);

      // Auto-scroll to bottom
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
    }
  };

  // Application control handlers
  const handleAppControl = async (action: 'restart' | 'stop' | 'start') => {
    if (!confirm(`Are you sure you want to ${action} the application?`)) return;

    setAppControlLoading(action);
    try {
      const response = await fetch(`/api/app-controls/${deploymentId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Application ${action}ed successfully!`);
        fetchDeployment();
      } else {
        alert(`Failed to ${action} application: ${data.message || data.error}`);
      }
    } catch (error: any) {
      console.error(`Failed to ${action} application:`, error);
      alert(`Failed to ${action} application: ${error.message}`);
    } finally {
      setAppControlLoading(null);
    }
  };

  // Handle deployment deletion
  const handleDelete = async () => {
    if (!deployment) return;

    // Cannot delete running deployments
    if (deployment.status === 'running' || deployment.status === 'pending') {
      alert('Cannot delete a running deployment. Please wait for it to complete or fail.');
      return;
    }

    try {
      setDeleting(true);
      await deploymentsAPI.delete(deploymentId);

      // Show success message
      alert('Deployment deleted successfully. AWS resources are being terminated in the background.');

      // Redirect to deployments list
      router.push('/dashboard/deployments');
    } catch (err: any) {
      console.error('Failed to delete deployment:', err);
      alert(err.response?.data?.message || 'Failed to delete deployment');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Handle SSH key download
  const handleDownloadSSHKey = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.focuswithfocal.io';
      const token = localStorage.getItem('focal_auth_token');

      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = `${apiUrl}/api/ssh-keys/${deploymentId}/download`;
      link.setAttribute('download', ''); // This hints that it should be downloaded

      // Fetch with proper authorization header
      const response = await fetch(`${apiUrl}/api/ssh-keys/${deploymentId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download SSH key');
      }

      // Get the filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `deployment-${deploymentId}.pem`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download SSH key:', err);
      alert(err.message || 'Failed to download SSH key');
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDeployment(), fetchLogs()]);
      setLoading(false);
    };

    loadData();
  }, [deploymentId]);

  // Auto-refresh for running deployments
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDeployment();
      fetchLogs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, deploymentId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'cancelled':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'terminated':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'failed':
        return <XCircle className="w-5 h-5" />;
      case 'cancelled':
        return <StopCircle className="w-5 h-5" />;
      case 'running':
        return <Activity className="w-5 h-5 animate-pulse" />;
      case 'pending':
        return <Clock className="w-5 h-5" />;
      case 'terminated':
        return <StopCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700 font-semibold';
      case 'warning':
        return 'text-yellow-700';
      default:
        return 'text-gray-700';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-1">
                Error Loading Deployment
              </h3>
              <p className="text-red-700">{error || 'Deployment not found'}</p>
              <button
                onClick={() => router.push('/dashboard/deployments')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Deployments
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/deployments')}
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deployments
        </button>

        {/* Deployment Name */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {deployment.projectName}
          </h1>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(deployment.status)}`}>
              {getStatusIcon(deployment.status)}
              {deployment.status.charAt(0).toUpperCase() + deployment.status.slice(1)}
            </span>
            <span className="text-sm text-gray-500">
              {deployment.region} • {deployment.instanceType}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
            <button
              onClick={() => {
                fetchDeployment();
                fetchLogs();
              }}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Terminal and SSL buttons - only show for completed deployments with instances */}
            {deployment.status === 'completed' && deployment.publicIp && (
              <>
                <Link
                  href={`/dashboard/deployments/${deploymentId}/terminal`}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors inline-flex items-center gap-2"
                  title="Open SSH Terminal"
                >
                  <Terminal className="w-4 h-4" />
                  Terminal
                </Link>

                <Link
                  href={`/dashboard/deployments/${deploymentId}/ssl`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                  title="Manage SSL Certificate"
                >
                  <Shield className="w-4 h-4" />
                  SSL
                </Link>
              </>
            )}

            {/* Application Controls - only show for completed deployments with instances */}
            {deployment.status === 'completed' && deployment.publicIp && (
              <>
                <button
                  onClick={() => handleAppControl('restart')}
                  disabled={appControlLoading !== null}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Restart application"
                >
                  {appControlLoading === 'restart' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Restart App
                </button>

                <button
                  onClick={() => handleAppControl('stop')}
                  disabled={appControlLoading !== null}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Stop application"
                >
                  {appControlLoading === 'stop' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <StopCircle className="w-4 h-4" />
                  )}
                  Stop App
                </button>

                <button
                  onClick={() => handleAppControl('start')}
                  disabled={appControlLoading !== null}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Start application"
                >
                  {appControlLoading === 'start' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start App
                </button>
              </>
            )}

            {/* Deploy Application Button - only show for completed deployments */}
            {deployment.status === 'completed' && (
              <button
                onClick={() => router.push(`/dashboard/deployments/${deploymentId}/deploy`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-opacity-90 transition-all inline-flex items-center gap-2 font-semibold"
                title="Deploy your application to this server"
              >
                <Rocket className="w-4 h-4" />
                Deploy Application
              </button>
            )}

            {/* View Live Progress - for running/pending deployments */}
            {(deployment.status === 'running' || deployment.status === 'pending') && (
              <>
                <Link
                  href={`/dashboard/deployments/${deploymentId}/live`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all inline-flex items-center gap-2 font-semibold animate-pulse"
                >
                  <Activity className="w-4 h-4" />
                  View Live Progress
                </Link>

                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to cancel this deployment? This cannot be undone.')) return;
                    try {
                      const response = await deploymentsAPI.cancel(deploymentId);
                      if (response.data.success) {
                        alert('Deployment cancelled successfully!');
                        fetchDeployment();
                        fetchLogs();
                      }
                    } catch (err: any) {
                      alert(err.response?.data?.message || 'Failed to cancel deployment');
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all inline-flex items-center gap-2 font-semibold"
                  title="Cancel this deployment"
                >
                  <StopCircle className="w-4 h-4" />
                  Cancel Deployment
                </button>
              </>
            )}

            {/* Retry/Resume Button - only show for failed or cancelled deployments */}
            {(deployment.status === 'failed' || deployment.status === 'cancelled') && (
              <button
                onClick={async () => {
                  if (!confirm('Would you like to retry this deployment? The system will attempt to resume from where it failed.')) return;
                  try {
                    const response = await deploymentsAPI.retry(deploymentId);
                    if (response.data.success) {
                      alert('Deployment retry initiated! The page will refresh to show progress.');
                      setAutoRefresh(true);
                      fetchDeployment();
                      fetchLogs();
                    }
                  } catch (err: any) {
                    alert(err.response?.data?.message || 'Failed to retry deployment');
                  }
                }}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all inline-flex items-center gap-2 font-semibold"
                title="Retry deployment from where it failed"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Deployment
              </button>
            )}

            {/* Delete Button - only show for completed/failed/terminated/cancelled deployments */}
            {deployment.status !== 'running' && deployment.status !== 'pending' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 border border-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                title="Delete deployment and cleanup AWS resources"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
        </div>
      </div>

      {/* Error Message */}
      {deployment.errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-1">Deployment Error</h4>
              <p className="text-red-700 text-sm">{deployment.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Instance ID</h3>
          </div>
          <p className="text-sm font-mono text-gray-900">
            {deployment.instanceId || 'Not created yet'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Public IP</h3>
          </div>
          <p className="text-sm font-mono text-gray-900">
            {deployment.publicIp || 'Not allocated yet'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Play className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Started</h3>
          </div>
          <p className="text-sm text-gray-900">
            {deployment.startedAt
              ? new Date(deployment.startedAt).toLocaleString()
              : 'Not started'
            }
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          </div>
          <p className="text-sm text-gray-900">
            {deployment.completedAt
              ? new Date(deployment.completedAt).toLocaleString()
              : 'In progress'
            }
          </p>
        </div>
      </div>

      {/* SSH Connection Info */}
      {deployment.status === 'completed' && deployment.connectionInfo && deployment.publicIp && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Connection Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SSH Command */}
            {deployment.connectionInfo.sshCommand && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">SSH Command</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deployment.connectionInfo!.sshCommand!);
                      alert('SSH command copied to clipboard!');
                    }}
                    className="text-blue-600 hover:text-blue-700"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <code className="block text-xs font-mono text-gray-900 bg-gray-50 p-2 rounded break-all">
                  {deployment.connectionInfo.sshCommand}
                </code>
              </div>
            )}

            {/* Public IP */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Public IP</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(deployment.publicIp!);
                    alert('IP address copied to clipboard!');
                  }}
                  className="text-blue-600 hover:text-blue-700"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <code className="block text-sm font-mono text-gray-900">
                {deployment.publicIp}
              </code>
            </div>

            {/* SSH Key Path */}
            {deployment.connectionInfo.sshKeyPath && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">SSH Key Location</span>
                </div>
                <code className="block text-xs font-mono text-gray-900">
                  {deployment.connectionInfo.sshKeyPath}
                </code>
              </div>
            )}

            {/* Username & Port */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Connection Details</span>
                </div>
                {deployment.status === 'completed' && (
                  <button
                    onClick={handleDownloadSSHKey}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Download SSH private key"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download SSH Key
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-900 space-y-1">
                <div><span className="text-gray-600">Username:</span> <code className="font-mono">{deployment.configuration?.deploymentUsername || deployment.connectionInfo?.username || 'ubuntu'}</code></div>
                <div><span className="text-gray-600">Port:</span> <code className="font-mono">{deployment.configuration?.sshPort || deployment.connectionInfo?.port || 22}</code></div>
              </div>
            </div>

            {/* Security Group */}
            {deployment.connectionInfo.securityGroupId && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Security Group</span>
                </div>
                <div className="text-xs font-mono text-gray-900 space-y-1">
                  <div>{deployment.connectionInfo.securityGroupId}</div>
                  {deployment.connectionInfo.securityGroupName && (
                    <div className="text-gray-600">{deployment.connectionInfo.securityGroupName}</div>
                  )}
                </div>
              </div>
            )}

            {/* S3 Bucket */}
            {deployment.connectionInfo.s3BucketName && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">S3 Bucket</span>
                </div>
                <code className="block text-xs font-mono text-gray-900">
                  {deployment.connectionInfo.s3BucketName}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Server Metrics */}
      {deployment.status === 'completed' && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Server Metrics</h2>
          </div>
          <MetricsDashboard deploymentId={deploymentId} autoRefresh={autoRefresh} />
        </div>
      )}

      {/* Deployment Logs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Deployment Logs</h2>
            <span className="text-sm text-gray-500">({logs.length} entries)</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        <div className="p-4 bg-gray-900 min-h-[500px] max-h-[600px] overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No logs available yet
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 hover:bg-gray-800 px-2 py-1 rounded">
                  <span className="text-gray-500 flex-shrink-0 w-24">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`flex-shrink-0 ${getLogLevelStyle(log.level)}`}>
                    {getLogLevelIcon(log.level)}
                  </span>
                  <span className={`flex-1 ${getLogLevelStyle(log.level)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Configuration Details */}
      {deployment.configuration && Object.keys(deployment.configuration).length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
          <pre className="bg-gray-50 rounded-lg p-4 overflow-x-auto text-sm">
            {JSON.stringify(deployment.configuration, null, 2)}
          </pre>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Deployment
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete <strong>{deployment.projectName}</strong>?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Warning:</strong> This will:
                  </p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside mt-2 space-y-1">
                    <li>Terminate the EC2 instance ({deployment.instanceId || 'if exists'})</li>
                    <li>Delete the SSH keypair</li>
                    <li>Remove the deployment record</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
