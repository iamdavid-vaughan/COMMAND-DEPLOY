'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deploymentsAPI, usageAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Rocket,
  Server,
  TrendingUp,
  Crown,
  Plus,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Stats {
  totalDeployments: number;
  activeInstances: number;
  deploymentsThisMonth: number;
  currentTier: string;
}

interface Deployment {
  id: string;
  project_name: string;
  status: string;
  created_at: string;
  public_ip?: string;
}

interface UsageData {
  date: string;
  deployments: number;
  apiCalls: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalDeployments: 0,
    activeInstances: 0,
    deploymentsThisMonth: 0,
    currentTier: 'starter',
  });
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([]);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch deployments
      const deploymentsResponse = await deploymentsAPI.list({ limit: 5 });
      const deployments = deploymentsResponse.data.deployments || [];
      setRecentDeployments(deployments);

      // Fetch usage data
      const usageResponse = await usageAPI.current('month');
      const usage = usageResponse.data;

      // Calculate stats
      const activeCount = deployments.filter(
        (d: Deployment) => d.status === 'active' || d.status === 'running'
      ).length;

      setStats({
        totalDeployments: usage.totalDeployments || deployments.length,
        activeInstances: activeCount,
        deploymentsThisMonth: usage.deploymentsThisMonth || 0,
        currentTier: user?.licenseTier || 'starter',
      });

      // Generate mock usage trend data (replace with real data from API)
      const mockUsageData = generateMockUsageData();
      setUsageData(mockUsageData);

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  const generateMockUsageData = (): UsageData[] => {
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        deployments: Math.floor(Math.random() * 10) + 1,
        apiCalls: Math.floor(Math.random() * 100) + 20,
      });
    }
    return data;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
      case 'deploying':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      running: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      deploying: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      error: 'bg-red-100 text-red-800',
      stopped: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          colors[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Welcome back, {user?.name || 'User'}!
          </p>
        </div>
        <Link
          href="/dashboard/deployments/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Deployment
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Deployments */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deployments</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.totalDeployments}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Rocket className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Active Instances */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Instances</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.activeInstances}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Server className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Deployments This Month */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.deploymentsThisMonth}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Current Tier */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current Plan</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 capitalize">
                {stats.currentTier}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Crown className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <Link
            href="/dashboard/billing"
            className="mt-3 text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            Upgrade plan →
          </Link>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployment Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Deployment Activity
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="deployments"
                stroke="#3B82F6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* API Usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            API Usage (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="apiCalls" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Deployments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Deployments</h3>
          <Link
            href="/dashboard/deployments"
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            View all →
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {recentDeployments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Rocket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No deployments yet</p>
              <Link
                href="/dashboard/deployments/new"
                className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500 font-medium"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create your first deployment
              </Link>
            </div>
          ) : (
            recentDeployments.map((deployment) => (
              <div
                key={deployment.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <Link
                        href={`/dashboard/deployments/${deployment.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {deployment.project_name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {deployment.public_ip || 'No IP assigned'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(deployment.status)}
                    <p className="text-sm text-gray-500">
                      {new Date(deployment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/deployments/new"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <Rocket className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900">New Deployment</h3>
          <p className="mt-1 text-sm text-gray-500">
            Deploy a new instance in minutes
          </p>
        </Link>

        <Link
          href="/dashboard/credentials"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <Server className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900">Manage Credentials</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add or update cloud credentials
          </p>
        </Link>

        <Link
          href="/dashboard/api-docs"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <Activity className="h-8 w-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900">API Documentation</h3>
          <p className="mt-1 text-sm text-gray-500">
            Integrate with our API
          </p>
        </Link>
      </div>
    </div>
  );
}
