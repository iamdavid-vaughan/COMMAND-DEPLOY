/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Activity,
  Server,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface DeploymentHealth {
  id: number;
  name: string;
  status: HealthStatus;
  lastCheck: Date;
  uptime: number;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    responseTime: number;
  };
  ssl: {
    valid: boolean;
    expiresAt: Date;
    daysUntilExpiry: number;
  };
  url?: string;
}

export default function MonitoringPage() {
  const [deployments, setDeployments] = useState<DeploymentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMonitoringData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchMonitoringData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchMonitoringData = async () => {
    try {
      const response = await api.get('/api/monitoring/deployments');
      setDeployments(response.data.deployments.map((d: any) => ({
        ...d,
        lastCheck: new Date(d.lastCheck),
        ssl: {
          ...d.ssl,
          expiresAt: new Date(d.ssl.expiresAt)
        }
      })));
      setLastUpdated(new Date());
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getMetricColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const healthyCount = deployments.filter(d => d.status === 'healthy').length;
  const degradedCount = deployments.filter(d => d.status === 'degraded').length;
  const downCount = deployments.filter(d => d.status === 'down').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Real-time health and performance metrics for all deployments
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoRefresh
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
          </button>
          <button
            onClick={() => fetchMonitoringData()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Deployments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {deployments.length}
              </p>
            </div>
            <Server className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Healthy</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {healthyCount}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Degraded</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {degradedCount}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Down</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {downCount}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-gray-600">
        Last updated: {lastUpdated.toLocaleString()}
        {autoRefresh && ' (refreshes every 30 seconds)'}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Deployments List */}
      {deployments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Deployments Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first deployment to start monitoring
          </p>
          <Link
            href="/dashboard/deployments/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Deployment
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className={`bg-white rounded-lg shadow-sm border-2 ${getStatusColor(
                deployment.status
              )} p-6`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(deployment.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {deployment.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Uptime: {formatUptime(deployment.uptime)} • Last check:{' '}
                      {deployment.lastCheck.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {deployment.url && (
                    <a
                      href={deployment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Visit
                    </a>
                  )}
                  <Link
                    href={`/dashboard/deployments/${deployment.id}`}
                    className="inline-flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* CPU */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Cpu className="w-4 h-4 text-gray-600 mr-1" />
                      <span className="text-xs text-gray-600">CPU</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getMetricColor(
                        deployment.metrics.cpu,
                        { warning: 70, critical: 90 }
                      )}`}
                    >
                      {deployment.metrics.cpu}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        deployment.metrics.cpu >= 90
                          ? 'bg-red-500'
                          : deployment.metrics.cpu >= 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(deployment.metrics.cpu, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Memory */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Activity className="w-4 h-4 text-gray-600 mr-1" />
                      <span className="text-xs text-gray-600">Memory</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getMetricColor(
                        deployment.metrics.memory,
                        { warning: 80, critical: 95 }
                      )}`}
                    >
                      {deployment.metrics.memory}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        deployment.metrics.memory >= 95
                          ? 'bg-red-500'
                          : deployment.metrics.memory >= 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(deployment.metrics.memory, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Disk */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <HardDrive className="w-4 h-4 text-gray-600 mr-1" />
                      <span className="text-xs text-gray-600">Disk</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getMetricColor(
                        deployment.metrics.disk,
                        { warning: 80, critical: 95 }
                      )}`}
                    >
                      {deployment.metrics.disk}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        deployment.metrics.disk >= 95
                          ? 'bg-red-500'
                          : deployment.metrics.disk >= 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(deployment.metrics.disk, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Response Time */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Wifi className="w-4 h-4 text-gray-600 mr-1" />
                      <span className="text-xs text-gray-600">Response</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${getMetricColor(
                        deployment.metrics.responseTime,
                        { warning: 1000, critical: 3000 }
                      )}`}
                    >
                      {deployment.metrics.responseTime}ms
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {deployment.metrics.responseTime < 500
                      ? 'Excellent'
                      : deployment.metrics.responseTime < 1000
                      ? 'Good'
                      : deployment.metrics.responseTime < 3000
                      ? 'Slow'
                      : 'Critical'}
                  </div>
                </div>
              </div>

              {/* SSL Status */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield
                      className={`w-5 h-5 mr-2 ${
                        deployment.ssl.valid && deployment.ssl.daysUntilExpiry > 30
                          ? 'text-green-600'
                          : deployment.ssl.valid && deployment.ssl.daysUntilExpiry > 7
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    />
                    <span className="text-sm text-gray-700">
                      SSL Certificate:{' '}
                      {deployment.ssl.valid ? (
                        <>
                          Valid
                          {deployment.ssl.daysUntilExpiry < 30 && (
                            <span
                              className={`ml-2 ${
                                deployment.ssl.daysUntilExpiry < 7
                                  ? 'text-red-600 font-semibold'
                                  : 'text-yellow-600'
                              }`}
                            >
                              (expires in {deployment.ssl.daysUntilExpiry} days)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600 font-semibold">Invalid or Expired</span>
                      )}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/deployments/${deployment.id}/ssl`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Manage SSL
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
