'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { adminAPI } from '@/lib/api';
import {
  HardDrive,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Search,
  Download,
  BarChart3
} from 'lucide-react';

interface StorageStats {
  totalStorageUsedGB: number;
  totalStorageQuotaGB: number;
  percentageUsed: number;
  totalUsers: number;
  usersNearLimit: number;
  averageUsagePerUser: number;
}

interface UserStorage {
  userId: string;
  email: string;
  name: string;
  storagePath: string;
  storageUsedGB: number;
  storageQuotaGB: number;
  percentageUsed: number;
  lastCalculated: string | null;
  licenseTier: string;
  status: string;
}

export default function AdminUsagePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [userStorageList, setUserStorageList] = useState<UserStorage[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserStorage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'usage' | 'percent' | 'email'>('percent');
  const [filterWarning, setFilterWarning] = useState(false);

  useEffect(() => {
    // Check if user is super admin
    if (user && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    fetchStorageStats();
  }, [user, router]);

  useEffect(() => {
    // Filter and sort user storage list
    let filtered = [...userStorageList];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply warning filter
    if (filterWarning) {
      filtered = filtered.filter(u => u.percentageUsed >= 80);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.storageUsedGB - a.storageUsedGB;
        case 'percent':
          return b.percentageUsed - a.percentageUsed;
        case 'email':
          return a.email.localeCompare(b.email);
        default:
          return 0;
      }
    });

    setFilteredUsers(filtered);
  }, [userStorageList, searchTerm, sortBy, filterWarning]);

  const fetchStorageStats = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getStorageStats();
      setStats(response.data.stats);
      setUserStorageList(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
      alert('Failed to load storage statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateStorage = async (userId: string) => {
    try {
      await adminAPI.recalculateUserStorage(userId);
      alert('Storage recalculation started. This may take a few moments.');
      await fetchStorageStats();
    } catch (error) {
      console.error('Failed to recalculate storage:', error);
      alert('Failed to recalculate storage');
    }
  };

  const formatBytes = (gb: number) => {
    if (gb < 1) {
      return `${(gb * 1024).toFixed(2)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 80) return 'text-orange-600';
    if (percent >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageBgColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-100 border-red-300';
    if (percent >= 80) return 'bg-orange-100 border-orange-300';
    if (percent >= 60) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading storage statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <HardDrive className="w-8 h-8 mr-3 text-blue-600" />
          Storage Usage & Analytics
        </h1>
        <p className="mt-2 text-gray-600">
          Monitor S3 storage usage, client statistics, and storage analytics
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Storage Used */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Storage Used</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(stats.totalStorageUsedGB)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  of {formatBytes(stats.totalStorageQuotaGB)} allocated
                </p>
              </div>
              <HardDrive className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.percentageUsed, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">{stats.percentageUsed.toFixed(1)}% used</p>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">with storage allocated</p>
              </div>
              <Users className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          {/* Average Usage */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Usage/User</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(stats.averageUsagePerUser)}
                </p>
                <p className="text-xs text-gray-500 mt-1">per user average</p>
              </div>
              <TrendingUp className="w-12 h-12 text-purple-600 opacity-20" />
            </div>
          </div>

          {/* Users Near Limit */}
          <div className={`rounded-lg shadow-md p-6 border ${stats.usersNearLimit > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Near Limit (≥80%)</p>
                <p className={`text-2xl font-bold mt-1 ${stats.usersNearLimit > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {stats.usersNearLimit}
                </p>
                <p className="text-xs text-gray-500 mt-1">users need attention</p>
              </div>
              <AlertTriangle className={`w-12 h-12 opacity-20 ${stats.usersNearLimit > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Sort */}
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="percent">% Used (High to Low)</option>
              <option value="usage">Storage Used (High to Low)</option>
              <option value="email">Email (A-Z)</option>
            </select>
          </div>

          {/* Filter Warning */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterWarning}
              onChange={(e) => setFilterWarning(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Show only warnings (≥80%)</span>
          </label>
        </div>
      </div>

      {/* User Storage List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            Client Storage Details ({filteredUsers.length} users)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Storage Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || filterWarning ? 'No users match the current filters' : 'No storage data available'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((userStorage) => (
                  <tr
                    key={userStorage.userId}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/admin/usage/${userStorage.userId}`)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{userStorage.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{userStorage.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {userStorage.licenseTier}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatBytes(userStorage.storageUsedGB)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatBytes(userStorage.storageQuotaGB)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                userStorage.percentageUsed >= 90 ? 'bg-red-600' :
                                userStorage.percentageUsed >= 80 ? 'bg-orange-600' :
                                userStorage.percentageUsed >= 60 ? 'bg-yellow-600' :
                                'bg-green-600'
                              }`}
                              style={{ width: `${Math.min(userStorage.percentageUsed, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className={`text-sm font-medium ${getUsageColor(userStorage.percentageUsed)}`}>
                          {userStorage.percentageUsed.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {userStorage.percentageUsed >= 90 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Critical
                        </span>
                      ) : userStorage.percentageUsed >= 80 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> Warning
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded w-fit">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <Link
                        href={`/dashboard/admin/usage/${userStorage.userId}`}
                        className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
