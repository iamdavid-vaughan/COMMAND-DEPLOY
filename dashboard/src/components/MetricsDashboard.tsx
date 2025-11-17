'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface ServerMetric {
  id: string;
  deployment_id: string;
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_rx_mb: number;
  network_tx_mb: number;
  app_status: 'online' | 'offline' | 'error' | 'unknown';
  app_uptime: string;
  app_memory_mb: number;
  process_count: number;
  load_avg_1min: number;
  load_avg_5min: number;
  load_avg_15min: number;
  recorded_at: string;
}

interface MetricsSummary {
  current: ServerMetric | null;
  averages: {
    cpu: number;
    ram: number;
    disk: number;
  };
  status: 'healthy' | 'warning' | 'critical' | 'offline';
}

interface MetricsDashboardProps {
  deploymentId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function MetricsDashboard({
  deploymentId,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}/metrics/summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('No metrics available yet. Deploy an application to start collecting metrics.');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.summary);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [deploymentId, autoRefresh, refreshInterval]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'offline':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Activity className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAppStatusIcon = (appStatus: string) => {
    switch (appStatus) {
      case 'online':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getMetricColor = (value: number, type: 'cpu' | 'ram' | 'disk') => {
    if (value >= 90) return 'text-red-600';
    if (value >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (value: number) => {
    if (value >= 90) return 'bg-red-500';
    if (value >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-900 mb-1">Metrics Not Available</h4>
            <p className="text-yellow-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics || !metrics.current) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Waiting for Metrics</h4>
            <p className="text-blue-700 text-sm">
              Monitoring data will appear here once your application is deployed and the monitoring agent is running.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { current, averages, status } = metrics;

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className={`border rounded-lg p-4 ${getStatusColor(status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h3 className="font-semibold capitalize">{status} Status</h3>
              <p className="text-sm opacity-90">
                Last updated: {new Date(current.recorded_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
          {current.app_status && (
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded">
              {getAppStatusIcon(current.app_status)}
              <span className="text-sm font-medium capitalize">{current.app_status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CPU */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-600">CPU Usage</h4>
              <p className={`text-2xl font-bold ${getMetricColor(current.cpu_percent, 'cpu')}`}>
                {current.cpu_percent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressBarColor(current.cpu_percent)}`}
              style={{ width: `${Math.min(current.cpu_percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Avg: {averages.cpu.toFixed(1)}% | Load: {current.load_avg_1min.toFixed(2)}
          </p>
        </div>

        {/* RAM */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <MemoryStick className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-600">Memory Usage</h4>
              <p className={`text-2xl font-bold ${getMetricColor(current.ram_percent, 'ram')}`}>
                {current.ram_percent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressBarColor(current.ram_percent)}`}
              style={{ width: `${Math.min(current.ram_percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {(current.ram_used_mb / 1024).toFixed(1)} GB / {(current.ram_total_mb / 1024).toFixed(1)} GB
          </p>
        </div>

        {/* Disk */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-600">Disk Usage</h4>
              <p className={`text-2xl font-bold ${getMetricColor(current.disk_percent, 'disk')}`}>
                {current.disk_percent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressBarColor(current.disk_percent)}`}
              style={{ width: `${Math.min(current.disk_percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {current.disk_used_gb} GB / {current.disk_total_gb} GB used
          </p>
        </div>

        {/* Network */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Network className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-600">Network Traffic</h4>
              <div className="text-sm font-semibold text-gray-900 space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-green-600">↓</span>
                  {current.network_rx_mb.toFixed(2)} MB
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-600">↑</span>
                  {current.network_tx_mb.toFixed(2)} MB
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* App Info */}
        {current.app_uptime && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-600">Application</h4>
                <p className="text-sm font-semibold text-gray-900">
                  Uptime: {current.app_uptime}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Memory: {current.app_memory_mb} MB | Processes: {current.process_count}
            </p>
          </div>
        )}

        {/* Load Average */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-600">Load Average</h4>
              <div className="text-sm font-semibold text-gray-900 space-y-0.5">
                <div>1m: {current.load_avg_1min.toFixed(2)}</div>
                <div className="text-xs">
                  5m: {current.load_avg_5min.toFixed(2)} | 15m: {current.load_avg_15min.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
