'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { deploymentsAPI } from '@/lib/api';
import {
  Rocket,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface Deployment {
  id: string;
  project_name: string;
  status: string;
  region: string;
  instance_type: string;
  public_ip?: string;
  instance_id?: string;
  domains?: string[];
  created_at: string;
  updated_at: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [filteredDeployments, setFilteredDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDeployments();
  }, []);

  useEffect(() => {
    filterDeployments();
  }, [deployments, searchTerm, statusFilter]);

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await deploymentsAPI.list({});
      setDeployments(response.data.deployments || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch deployments:', err);
      setError(err.response?.data?.message || 'Failed to load deployments');
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDeployments();
    setRefreshing(false);
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete deployment "${projectName}"?`)) {
      return;
    }

    try {
      await deploymentsAPI.delete(id);
      setDeployments(deployments.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete deployment');
    }
  };

  const filterDeployments = () => {
    let filtered = deployments;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (d) =>
          d.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.public_ip?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.instance_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDeployments(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
      case 'deploying':
        return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'stopped':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
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
          <p className="mt-4 text-gray-600">Loading deployments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deployments</h1>
          <p className="mt-1 text-gray-500">
            Manage your cloud deployments
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/dashboard/deployments/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Deployment
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search deployments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="deploying">Deploying</option>
              <option value="stopped">Stopped</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Deployments table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredDeployments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Rocket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {deployments.length === 0
                ? 'No deployments yet'
                : 'No deployments match your filters'}
            </p>
            {deployments.length === 0 && (
              <Link
                href="/dashboard/deployments/new"
                className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500 font-medium"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create your first deployment
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDeployments.map((deployment) => (
                  <tr key={deployment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(deployment.status)}
                        <Link
                          href={`/dashboard/deployments/${deployment.id}`}
                          className="ml-3 font-medium text-gray-900 hover:text-blue-600"
                        >
                          {deployment.project_name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(deployment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {deployment.region || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {deployment.instance_type || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {deployment.public_ip ? (
                        <div className="flex items-center">
                          <code className="text-sm text-gray-900">
                            {deployment.public_ip}
                          </code>
                          <a
                            href={`http://${deployment.public_ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:text-blue-500"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(deployment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/dashboard/deployments/${deployment.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(deployment.id, deployment.project_name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredDeployments.length > 0 && (
        <div className="text-sm text-gray-500">
          Showing {filteredDeployments.length} of {deployments.length} deployments
        </div>
      )}
    </div>
  );
}
