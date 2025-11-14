'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { adminAPI } from '@/lib/api';
import {
  Users,
  Search,
  Filter,
  Edit,
  Trash2,
  Key,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Activity,
  UserCheck,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  licenseTier: string;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  totalDeployments: number;
  usersByTier: {
    starter: number;
    pro: number;
    max: number;
    enterprise: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Check if user is super admin
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  // Load data
  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, filterStatus, filterTier]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load users with filters
      const usersResponse = await adminAPI.users({
        page: currentPage,
        limit: 20,
        search: searchTerm,
        status: filterStatus,
        tier: filterTier,
      });

      setUsers(usersResponse.data.users);
      setTotalUsers(usersResponse.data.total);

      // Load stats
      const statsResponse = await adminAPI.stats();
      setStats(statsResponse.data.stats);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (updatedData: Partial<User>) => {
    if (!selectedUser) return;

    try {
      await adminAPI.updateUser(selectedUser.id, {
        firstName: updatedData.firstName,
        lastName: updatedData.lastName,
        companyName: updatedData.companyName ?? undefined,
        licenseTier: updatedData.licenseTier,
        status: updatedData.status,
        role: updatedData.role,
      });

      setMessage({
        type: 'success',
        text: 'User updated successfully',
      });

      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update user',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      await adminAPI.resetPassword(selectedUser.id, newPassword);

      setMessage({
        type: 'success',
        text: 'Password reset successfully',
      });

      setResetPasswordModalOpen(false);
      setNewPassword('');
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reset password',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await adminAPI.deleteUser(selectedUser.id);

      setMessage({
        type: 'success',
        text: 'User deleted successfully',
      });

      setDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete user',
      });
    }
  };

  const totalPages = Math.ceil(totalUsers / 20);

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Admin Panel
          </h1>
          <p className="mt-2 text-gray-600">Manage users, monitor platform statistics, and system settings</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <a
            href="/dashboard/admin/security"
            className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-sm p-6 text-white hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Security Audit</h3>
            </div>
            <p className="text-blue-100 text-sm">
              View audit logs, track sensitive actions, and monitor security events
            </p>
          </a>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeUsers}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Deployments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalDeployments}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name, or company..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="trial">Trial</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <select
                  value={filterTier}
                  onChange={(e) => {
                    setFilterTier(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Tiers</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="max">Max</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{u.name}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.companyName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            u.licenseTier === 'enterprise'
                              ? 'bg-purple-100 text-purple-800'
                              : u.licenseTier === 'max'
                              ? 'bg-blue-100 text-blue-800'
                              : u.licenseTier === 'pro'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.licenseTier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            u.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : u.status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setEditModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setResetPasswordModalOpen(true);
                            }}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setDeleteModalOpen(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {currentPage} of {totalPages} ({totalUsers} total users)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editModalOpen && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setEditModalOpen(false)}
          onSave={handleEditUser}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordModalOpen && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onClose={() => {
            setResetPasswordModalOpen(false);
            setNewPassword('');
          }}
          onConfirm={handleResetPassword}
        />
      )}

      {/* Delete User Modal */}
      {deleteModalOpen && selectedUser && (
        <DeleteUserModal
          user={selectedUser}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    companyName: user.companyName || '',
    licenseTier: user.licenseTier,
    status: user.status,
    role: user.role,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Tier
            </label>
            <select
              value={formData.licenseTier}
              onChange={(e) => setFormData({ ...formData, licenseTier: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="trial">Trial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Reset Password Modal Component
function ResetPasswordModal({
  user,
  newPassword,
  setNewPassword,
  onClose,
  onConfirm,
}: {
  user: User;
  newPassword: string;
  setNewPassword: (password: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min 12 chars)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-2 text-xs text-gray-500">
            Password must be at least 12 characters and contain uppercase, lowercase, number, and
            special character (@$!%*?&)
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={newPassword.length < 12}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete User Modal Component
function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-red-600">Delete User</h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700">
            Are you sure you want to delete the user <strong>{user.email}</strong>?
          </p>
          <p className="mt-2 text-sm text-red-600 font-medium">
            This action cannot be undone. All user data, deployments, and credentials will be
            permanently deleted.
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
}
