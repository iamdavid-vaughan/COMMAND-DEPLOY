'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  HardDrive,
  Database,
  FolderOpen,
  Upload,
  Archive,
  FileText,
  Clock,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  User,
  Mail,
  Calendar,
  Package
} from 'lucide-react';
import { adminAPI } from '@/lib/api';

interface UserStorage {
  id: string;
  email: string;
  name: string;
  license_tier: string;
  storage_used_gb: number;
  storage_quota_gb: number;
  storage_percentage: number;
  storage_initialized_at: string | null;
  created_at: string;
  last_login: string | null;
}

interface StorageBreakdown {
  deployments: number;
  uploads: number;
  backups: number;
  logs: number;
  temp: number;
  billing: number;
  other: number;
}

export default function UserStorageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserStorage | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUserStorage();
  }, [userId]);

  const fetchUserStorage = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await adminAPI.getUserStorageDetail(userId);
      setUser(response.data.user);
      setBreakdown(response.data.breakdown);
    } catch (err: any) {
      console.error('Failed to fetch user storage:', err);
      setError(err.response?.data?.message || 'Failed to load user storage details');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      await adminAPI.recalculateUserStorage(userId);

      // Refresh data after recalculation
      await fetchUserStorage();

      alert('Storage recalculated successfully');
    } catch (err: any) {
      console.error('Failed to recalculate storage:', err);
      alert(err.response?.data?.message || 'Failed to recalculate storage');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user storage details...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading User</h2>
          <p className="text-gray-600 text-center mb-6">{error || 'User not found'}</p>
          <Link
            href="/dashboard/admin/usage"
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Back to Storage Usage
          </Link>
        </div>
      </div>
    );
  }

  const usagePercentage = Math.min((user.storage_used_gb / user.storage_quota_gb) * 100, 100);
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 95;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard/admin/usage"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Storage Details</h1>
                <p className="text-sm text-gray-600 mt-1">Detailed storage analytics and breakdown</p>
              </div>
            </div>

            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              <span>{recalculating ? 'Recalculating...' : 'Recalculate Storage'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Information Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">License Tier</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{user.license_tier}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Storage Used</h3>
              <HardDrive className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900">
                  {user.storage_used_gb.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">GB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isAtLimit ? 'bg-red-600' : isNearLimit ? 'bg-orange-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                {user.storage_quota_gb} GB available
              </p>
            </div>
          </div>

          {/* Quota */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Storage Quota</h3>
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900">
                  {user.storage_quota_gb}
                </span>
                <span className="text-sm text-gray-500">GB</span>
              </div>
              <p className="text-xs text-gray-500">
                {(user.storage_quota_gb - user.storage_used_gb).toFixed(2)} GB remaining
              </p>
            </div>
          </div>

          {/* Usage Percentage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Usage Percentage</h3>
              <TrendingUp className={`w-5 h-5 ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-500' : 'text-purple-600'}`} />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline space-x-2">
                <span className={`text-3xl font-bold ${
                  isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-500' : 'text-gray-900'
                }`}>
                  {usagePercentage.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500">%</span>
              </div>
              {isAtLimit && (
                <p className="text-xs text-red-600 font-medium">⚠️ At capacity limit</p>
              )}
              {isNearLimit && !isAtLimit && (
                <p className="text-xs text-orange-600 font-medium">⚠️ Approaching limit</p>
              )}
              {!isNearLimit && (
                <p className="text-xs text-gray-500">Healthy usage level</p>
              )}
            </div>
          </div>
        </div>

        {/* Storage Breakdown */}
        {breakdown && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Storage Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Deployments */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Deployments</p>
                    <p className="text-xs text-gray-500">Application files</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {breakdown.deployments.toFixed(2)} GB
                </span>
              </div>

              {/* Uploads */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Upload className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Uploads</p>
                    <p className="text-xs text-gray-500">User uploads</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {breakdown.uploads.toFixed(2)} GB
                </span>
              </div>

              {/* Backups */}
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Archive className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Backups</p>
                    <p className="text-xs text-gray-500">Backup files</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-purple-600">
                  {breakdown.backups.toFixed(2)} GB
                </span>
              </div>

              {/* Logs */}
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Logs</p>
                    <p className="text-xs text-gray-500">System logs</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-yellow-600">
                  {breakdown.logs.toFixed(2)} GB
                </span>
              </div>

              {/* Temp */}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Temporary</p>
                    <p className="text-xs text-gray-500">Temp files</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-orange-600">
                  {breakdown.temp.toFixed(2)} GB
                </span>
              </div>

              {/* Other */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <HardDrive className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Other</p>
                    <p className="text-xs text-gray-500">Misc files</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-600">
                  {breakdown.other.toFixed(2)} GB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Storage Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Storage Management</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Storage is calculated based on actual S3 bucket usage</li>
                <li>Use "Recalculate Storage" to refresh the latest usage data</li>
                <li>Quota is determined by the user's license tier</li>
                {user.storage_initialized_at && (
                  <li>
                    Storage initialized: {new Date(user.storage_initialized_at).toLocaleString()}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
