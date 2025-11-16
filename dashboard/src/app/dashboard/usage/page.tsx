'use client';

import { useEffect, useState } from 'react';
import { usageAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  BarChart3,
  Download,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface UsageLimits {
  deploymentsPerMonth: number;
  concurrentDeployments: number;
  maxInstances: number;
  storageGB: number;
  apiAccess: boolean;
}

interface UsageStats {
  deploymentsThisMonth: number;
  currentlyActive: number;
  totalInstances: number;
  storageUsed: number;
  limits: UsageLimits;
}

interface HistoricalDataPoint {
  month: string;
  deployments: number;
  apiCalls: number;
  storageGB: number;
}

export default function UsagePage() {
  const { user } = useAuthStore();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [currentUsage, limitsData, historyData] = await Promise.all([
        usageAPI.current('month'),
        usageAPI.limits(),
        usageAPI.history(6), // Last 6 months
      ]);

      setUsageStats({
        deploymentsThisMonth: currentUsage.data.deploymentsThisMonth || 0,
        currentlyActive: currentUsage.data.activeDeployments || 0,
        totalInstances: currentUsage.data.totalInstances || 0,
        storageUsed: currentUsage.data.storageUsedGB || 0,
        limits: limitsData.data.limits,
      });

      setHistoricalData(historyData.data.history || []);

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch usage data:', err);
      setError(err.response?.data?.message || 'Failed to load usage data');
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      setExporting(true);
      const response = await usageAPI.export(format, 'month');

      // Create download link
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(response.data, null, 2) : response.data],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExporting(false);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(err.response?.data?.message || 'Failed to export usage data');
      setExporting(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading usage data...</p>
        </div>
      </div>
    );
  }

  if (error || !usageStats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error || 'Failed to load usage data'}
      </div>
    );
  }

  const deploymentPercentage = getUsagePercentage(
    usageStats.deploymentsThisMonth,
    usageStats.limits.deploymentsPerMonth
  );
  const activePercentage = getUsagePercentage(
    usageStats.currentlyActive,
    usageStats.limits.concurrentDeployments
  );
  const instancePercentage = getUsagePercentage(
    usageStats.totalInstances,
    usageStats.limits.maxInstances
  );
  const storagePercentage = getUsagePercentage(
    usageStats.storageUsed,
    usageStats.limits.storageGB
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usage & Analytics</h1>
          <p className="mt-1 text-gray-500">
            Monitor your resource usage and limits
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <FileJson className="h-5 w-5 mr-2" />
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-5 w-5 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Current Plan</p>
            <h2 className="text-3xl font-bold mt-1 capitalize">
              {user?.licenseTier || 'Starter'}
            </h2>
            <p className="mt-2 text-blue-100">
              {usageStats.limits.apiAccess ? '✓ API Access Enabled' : 'Dashboard Access Only'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100">Monthly Deployments</p>
            <p className="text-2xl font-bold">
              {usageStats.deploymentsThisMonth} /{' '}
              {usageStats.limits.deploymentsPerMonth === -1
                ? '∞'
                : usageStats.limits.deploymentsPerMonth}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Deployments This Month */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">
              Deployments This Month
            </h3>
            {deploymentPercentage >= 90 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {usageStats.deploymentsThisMonth}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            of {usageStats.limits.deploymentsPerMonth === -1 ? 'unlimited' : usageStats.limits.deploymentsPerMonth} allowed
          </p>
          {usageStats.limits.deploymentsPerMonth !== -1 && (
            <>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(deploymentPercentage)}`}
                  style={{ width: `${deploymentPercentage}%` }}
                />
              </div>
              <p className={`text-sm font-medium mt-2 ${getUsageColor(deploymentPercentage)}`}>
                {deploymentPercentage.toFixed(1)}% used
              </p>
            </>
          )}
        </div>

        {/* Active Deployments */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">
              Active Deployments
            </h3>
            {activePercentage >= 90 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {usageStats.currentlyActive}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            of {usageStats.limits.concurrentDeployments === -1 ? 'unlimited' : usageStats.limits.concurrentDeployments} allowed
          </p>
          {usageStats.limits.concurrentDeployments !== -1 && (
            <>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(activePercentage)}`}
                  style={{ width: `${activePercentage}%` }}
                />
              </div>
              <p className={`text-sm font-medium mt-2 ${getUsageColor(activePercentage)}`}>
                {activePercentage.toFixed(1)}% used
              </p>
            </>
          )}
        </div>

        {/* Total Instances */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Total Instances</h3>
            {instancePercentage >= 90 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {usageStats.totalInstances}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            of {usageStats.limits.maxInstances === -1 ? 'unlimited' : usageStats.limits.maxInstances} allowed
          </p>
          {usageStats.limits.maxInstances !== -1 && (
            <>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(instancePercentage)}`}
                  style={{ width: `${instancePercentage}%` }}
                />
              </div>
              <p className={`text-sm font-medium mt-2 ${getUsageColor(instancePercentage)}`}>
                {instancePercentage.toFixed(1)}% used
              </p>
            </>
          )}
        </div>

        {/* Storage */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Storage Used</h3>
            {storagePercentage >= 90 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {usageStats.storageUsed.toFixed(1)} GB
          </p>
          <p className="text-sm text-gray-500 mt-1">
            of {usageStats.limits.storageGB === -1 ? 'unlimited' : `${usageStats.limits.storageGB} GB`} allowed
          </p>
          {usageStats.limits.storageGB !== -1 && (
            <>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(storagePercentage)}`}
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
              <p className={`text-sm font-medium mt-2 ${getUsageColor(storagePercentage)}`}>
                {storagePercentage.toFixed(1)}% used
              </p>
            </>
          )}
        </div>
      </div>

      {/* Warnings */}
      {(deploymentPercentage >= 90 ||
        activePercentage >= 90 ||
        instancePercentage >= 90 ||
        storagePercentage >= 90) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">
              Approaching Usage Limits
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              You're nearing your plan limits. Consider upgrading to avoid service
              interruptions.
            </p>
            <a
              href="/dashboard/billing"
              className="text-sm font-medium text-yellow-800 hover:text-yellow-900 mt-2 inline-block"
            >
              Upgrade Plan →
            </a>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {historicalData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deployments Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Deployments Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="deployments"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Deployments"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Resource Usage Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              Current Resource Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active Deployments', value: usageStats.currentlyActive },
                    { name: 'Total Instances', value: usageStats.totalInstances },
                    { name: 'Storage (GB)', value: Math.round(usageStats.storageUsed) },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#3b82f6" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* API Calls Over Time */}
          {usageStats.limits.apiAccess && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                API Calls Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="apiCalls" fill="#8b5cf6" name="API Calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Storage Usage Over Time */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              Storage Usage Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="storageGB"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Storage (GB)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Plan Features */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Your Plan Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-gray-700">
              {usageStats.limits.deploymentsPerMonth === -1
                ? 'Unlimited'
                : usageStats.limits.deploymentsPerMonth}{' '}
              deployments per month
            </span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-gray-700">
              {usageStats.limits.concurrentDeployments === -1
                ? 'Unlimited'
                : usageStats.limits.concurrentDeployments}{' '}
              concurrent deployments
            </span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-gray-700">
              {usageStats.limits.maxInstances === -1
                ? 'Unlimited'
                : usageStats.limits.maxInstances}{' '}
              instances
            </span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <span className="text-gray-700">
              {usageStats.limits.storageGB === -1
                ? 'Unlimited'
                : `${usageStats.limits.storageGB} GB`}{' '}
              storage
            </span>
          </div>
          <div className="flex items-center">
            {usageStats.limits.apiAccess ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">API access enabled</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-gray-400">API access not included</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
