'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  Lock,
  Unlock
} from 'lucide-react';
import api from '@/lib/api';

interface Deployment {
  id: string;
  projectName: string;
  domains: string[];
  publicIp: string | null;
  configuration: {
    ssl?: {
      useStaging?: boolean;
      enabled?: boolean;
    };
  };
}

interface SSLCertificate {
  domain: string;
  status: 'valid' | 'expiring' | 'expired' | 'none';
  expiresAt: string | null;
  issuer: string | null;
  useStaging: boolean;
}

export default function DeploymentSSLPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [certificate, setCertificate] = useState<SSLCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [deploymentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch deployment
      const deploymentRes = await api.get(`/api/deployments/${deploymentId}`);
      const deploymentData = deploymentRes.data.deployment;
      setDeployment(deploymentData);

      if (deploymentData.domains && deploymentData.domains.length > 0) {
        // Fetch SSL certificate info
        const sslRes = await api.get(`/api/ssl/certificates/${deploymentId}`);
        setCertificate(sslRes.data.certificate);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch SSL data:', err);
      setError(err.response?.data?.message || 'Failed to load SSL data');
      setLoading(false);
    }
  };

  const toggleStaging = async () => {
    if (!deployment) return;

    try {
      setToggling(true);
      const newStaging = !certificate?.useStaging;

      await api.put(`/api/ssl/certificates/${deploymentId}/toggle-staging`, {
        useStaging: newStaging
      });

      // Refresh data
      await fetchData();
      setToggling(false);
    } catch (err: any) {
      console.error('Failed to toggle staging:', err);
      setError(err.response?.data?.message || 'Failed to toggle staging mode');
      setToggling(false);
    }
  };

  const renewCertificate = async () => {
    try {
      setRenewing(true);
      await api.post(`/api/ssl/certificates/${deploymentId}/renew`);

      // Refresh data
      await fetchData();
      setRenewing(false);
    } catch (err: any) {
      console.error('Failed to renew certificate:', err);
      setError(err.response?.data?.message || 'Failed to renew certificate');
      setRenewing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Valid
          </span>
        );
      case 'expiring':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Expiring Soon
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <XCircle className="w-4 h-4 mr-1" />
            No Certificate
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SSL certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/deployments/${deploymentId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deployment
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Failed to load deployment'}</p>
        </div>
      </div>
    );
  }

  if (!deployment.domains || deployment.domains.length === 0) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/deployments/${deploymentId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deployment
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Domain Configured</h3>
              <p className="text-yellow-700">
                This deployment does not have a domain configured. SSL certificates require a domain.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/deployments/${deploymentId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deployment
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            SSL Certificate
          </h1>
          <button
            onClick={fetchData}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Certificate Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Certificate Status</h2>
            <p className="text-gray-600">Domain: {deployment.domains[0]}</p>
          </div>
          {certificate && getStatusBadge(certificate.status)}
        </div>

        {certificate && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center text-sm text-gray-500 mb-1">
                <Calendar className="w-4 h-4 mr-2" />
                Expiration Date
              </div>
              <p className="text-lg font-medium">
                {certificate.expiresAt
                  ? new Date(certificate.expiresAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>

            <div>
              <div className="flex items-center text-sm text-gray-500 mb-1">
                <Shield className="w-4 h-4 mr-2" />
                Issuer
              </div>
              <p className="text-lg font-medium">{certificate.issuer || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>

      {/* SSL Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">SSL Configuration</h2>

        {/* Staging Toggle */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                {certificate?.useStaging ? (
                  <Unlock className="w-5 h-5 text-yellow-600 mr-2" />
                ) : (
                  <Lock className="w-5 h-5 text-green-600 mr-2" />
                )}
                <h3 className="text-lg font-medium">
                  {certificate?.useStaging ? 'Staging Certificate' : 'Production Certificate'}
                </h3>
              </div>
              <p className="text-sm text-gray-600">
                {certificate?.useStaging
                  ? 'Using Let\'s Encrypt staging server for testing. Switch to production for a trusted certificate.'
                  : 'Using Let\'s Encrypt production server. Your certificate is trusted by all browsers.'}
              </p>
              {certificate?.useStaging && (
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Staging certificates will show browser warnings. Switch to production for a trusted certificate.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={toggleStaging}
              disabled={toggling}
              className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                certificate?.useStaging
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {toggling ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : certificate?.useStaging ? (
                'Switch to Production'
              ) : (
                'Switch to Staging'
              )}
            </button>
          </div>
        </div>

        {/* Renew Certificate */}
        <div>
          <h3 className="text-lg font-medium mb-2">Renew Certificate</h3>
          <p className="text-sm text-gray-600 mb-4">
            Manually renew your SSL certificate. Certificates are automatically renewed before expiration.
          </p>
          <button
            onClick={renewCertificate}
            disabled={renewing}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renewing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Renewing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Renew Certificate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
