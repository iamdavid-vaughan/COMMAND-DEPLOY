/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import api from '@/lib/api';

interface SSLCertificate {
  deployment_id: number;
  deployment_name: string;
  domain: string;
  valid: boolean;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  daysUntilExpiry: number;
  autoRenew: boolean;
  useStaging: boolean;
}

export default function SSLPage() {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const response = await api.get('/api/ssl/certificates');
      setCertificates(response.data.certificates || []);
    } catch (error) {
      console.error('Failed to fetch SSL certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (deploymentId: number) => {
    setRenewing(deploymentId);
    try {
      await api.post(`/api/ssl/certificates/${deploymentId}/renew`);
      alert('SSL certificate renewal initiated!');
      fetchCertificates();
    } catch (error) {
      alert('Failed to renew certificate');
    } finally {
      setRenewing(null);
    }
  };

  const toggleAutoRenew = async (deploymentId: number, currentValue: boolean) => {
    try {
      await api.put(`/api/ssl/certificates/${deploymentId}/auto-renew`, {
        autoRenew: !currentValue
      });
      fetchCertificates();
    } catch (error) {
      console.error('Failed to toggle auto-renew:', error);
    }
  };

  const toggleStaging = async (deploymentId: number, currentValue: boolean) => {
    setToggling(deploymentId);
    try {
      const response = await api.put(`/api/ssl/certificates/${deploymentId}/toggle-staging`, {
        useStaging: !currentValue
      });

      if (response.data.certificateRegenerated) {
        alert('SSL mode changed and certificate regenerated successfully!');
      } else if (response.data.error) {
        alert(`SSL mode changed but certificate regeneration failed: ${response.data.error}`);
      } else {
        alert(response.data.message || 'SSL mode changed successfully!');
      }

      fetchCertificates();
    } catch (error: any) {
      alert(`Failed to toggle SSL mode: ${error.response?.data?.message || error.message}`);
    } finally {
      setToggling(null);
    }
  };

  const getStatusColor = (cert: SSLCertificate) => {
    if (!cert.valid) return 'text-red-600 bg-red-50 border-red-200';
    if (cert.daysUntilExpiry <= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (cert.daysUntilExpiry <= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusIcon = (cert: SSLCertificate) => {
    if (!cert.valid || cert.daysUntilExpiry <= 7)
      return <XCircle className="w-5 h-5 text-red-600" />;
    if (cert.daysUntilExpiry <= 30)
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle className="w-5 h-5 text-green-600" />;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            SSL Certificates
          </h1>
          <p className="text-gray-600 mt-1">Manage SSL certificates for your deployments</p>
        </div>
        <button
          onClick={() => fetchCertificates()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No SSL Certificates</h3>
          <p className="text-gray-600">Deploy an application with a domain to manage SSL certificates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div
              key={cert.deployment_id}
              className={`bg-white rounded-lg shadow-sm border-2 p-6 ${getStatusColor(cert)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(cert)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{cert.deployment_name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <a
                        href={`https://${cert.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center"
                      >
                        {cert.domain}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-600">Issuer</div>
                  <div className="font-medium text-gray-900">{cert.issuer}</div>
                  {cert.useStaging && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Staging
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-600">Valid From</div>
                  <div className="font-medium text-gray-900">
                    {new Date(cert.validFrom).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Expires</div>
                  <div className={`font-medium ${
                    cert.daysUntilExpiry <= 7 ? 'text-red-600' :
                    cert.daysUntilExpiry <= 30 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {new Date(cert.validTo).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Days Until Expiry</div>
                  <div className={`text-2xl font-bold ${
                    cert.daysUntilExpiry <= 7 ? 'text-red-600' :
                    cert.daysUntilExpiry <= 30 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {cert.daysUntilExpiry}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cert.autoRenew}
                        onChange={() => toggleAutoRenew(cert.deployment_id, cert.autoRenew)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Auto-renew</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cert.useStaging}
                        onChange={() => toggleStaging(cert.deployment_id, cert.useStaging)}
                        disabled={toggling === cert.deployment_id}
                        className="h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-700">Use Staging (Testing)</span>
                    </label>
                    {cert.daysUntilExpiry <= 30 && (
                      <span className="text-sm text-yellow-700 font-medium">
                        ⚠️ Renewal recommended
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRenew(cert.deployment_id)}
                    disabled={renewing === cert.deployment_id}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {renewing === cert.deployment_id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Renewing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Renew Now
                      </>
                    )}
                  </button>
                </div>
                {cert.useStaging && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> This deployment is using Let's Encrypt staging certificates for testing.
                      Uncheck "Use Staging" to switch to production certificates that are trusted by browsers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
