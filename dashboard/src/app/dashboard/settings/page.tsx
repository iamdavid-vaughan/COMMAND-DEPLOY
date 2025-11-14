'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { userAPI, twoFactorAPI, passwordSecurityAPI } from '@/lib/api';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Bell,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  Shield,
  Smartphone,
  Key,
  Copy,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>(
    'profile'
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Profile form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: '',
  });

  // Security form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordCheck, setPasswordCheck] = useState<any>(null);
  const [checkingPassword, setCheckingPassword] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpToken, setTotpToken] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);

  // Notifications form
  const [notificationsData, setNotificationsData] = useState({
    emailNotifications: true,
    deploymentAlerts: true,
    usageAlerts: true,
    securityAlerts: true,
  });

  // Load 2FA status
  useEffect(() => {
    loadTwoFactorStatus();
  }, []);

  const loadTwoFactorStatus = async () => {
    try {
      const response = await twoFactorAPI.status();
      setTwoFactorEnabled(response.data.enabled);
      setBackupCodesRemaining(response.data.backupCodesRemaining || 0);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    }
  };

  // Check password security when it changes
  useEffect(() => {
    const checkPasswordSecurity = async () => {
      if (passwordData.newPassword.length >= 8) {
        setCheckingPassword(true);
        try {
          const response = await passwordSecurityAPI.checkStrength(passwordData.newPassword);
          setPasswordCheck(response.data);
        } catch (error) {
          console.error('Error checking password:', error);
        } finally {
          setCheckingPassword(false);
        }
      } else {
        setPasswordCheck(null);
      }
    };

    const debounce = setTimeout(checkPasswordSecurity, 500);
    return () => clearTimeout(debounce);
  }, [passwordData.newPassword]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // TODO: API call to update profile
      // await api.patch('/api/user/profile', profileData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMessage({
        type: 'success',
        text: 'Profile updated successfully',
      });

      // Update user in store
      if (user) {
        setUser({
          ...user,
          name: profileData.name,
          email: profileData.email,
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 [SETTINGS] Password change form submitted');
    setSaving(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      console.log('❌ [SETTINGS] Passwords do not match');
      setMessage({
        type: 'error',
        text: 'New passwords do not match',
      });
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 12) {
      console.log('❌ [SETTINGS] Password too short');
      setMessage({
        type: 'error',
        text: 'Password must be at least 12 characters',
      });
      setSaving(false);
      return;
    }

    try {
      // Check password for breaches first
      console.log('🔍 [SETTINGS] Checking password security...');
      const breachCheck = await passwordSecurityAPI.check(passwordData.newPassword);

      if (breachCheck.data.breached) {
        setMessage({
          type: 'error',
          text: `This password has been found in ${breachCheck.data.breachCount.toLocaleString()} data breaches. Please choose a different password.`,
        });
        setSaving(false);
        return;
      }

      if (breachCheck.data.score < 60) {
        setMessage({
          type: 'warning',
          text: 'This password is weak. We recommend choosing a stronger password.',
        });
      }

      console.log('🔐 [SETTINGS] Calling userAPI.changePassword...');
      const response = await userAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      console.log('✅ [SETTINGS] Password change response:', response.data);

      setMessage({
        type: 'success',
        text: 'Password updated successfully',
      });

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordCheck(null);
    } catch (err: any) {
      console.error('❌ [SETTINGS] Password change error:', err);
      console.error('❌ [SETTINGS] Error response:', err.response);
      console.error('❌ [SETTINGS] Error message:', err.response?.data?.message);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update password',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetup2FA = async () => {
    setLoading2FA(true);
    setMessage(null);

    try {
      const response = await twoFactorAPI.setup();
      setQrCode(response.data.qrCode);
      setBackupCodes(response.data.backupCodes);
      setMessage({
        type: 'success',
        text: 'Scan the QR code with your authenticator app',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to setup 2FA',
      });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpToken || totpToken.length !== 6) {
      setMessage({
        type: 'error',
        text: 'Please enter a 6-digit code from your authenticator app',
      });
      return;
    }

    setLoading2FA(true);
    setMessage(null);

    try {
      await twoFactorAPI.verify(totpToken);
      setTwoFactorEnabled(true);
      setQrCode('');
      setTotpToken('');
      setMessage({
        type: 'success',
        text: '2FA has been successfully enabled!',
      });
      await loadTwoFactorStatus();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Invalid verification code',
      });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!twoFactorPassword) {
      setMessage({
        type: 'error',
        text: 'Please enter your password to disable 2FA',
      });
      return;
    }

    setLoading2FA(true);
    setMessage(null);

    try {
      await twoFactorAPI.disable(twoFactorPassword);
      setTwoFactorEnabled(false);
      setTwoFactorPassword('');
      setMessage({
        type: 'success',
        text: '2FA has been disabled',
      });
      await loadTwoFactorStatus();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to disable 2FA',
      });
    } finally {
      setLoading2FA(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setLoading2FA(true);
    setMessage(null);

    try {
      const response = await twoFactorAPI.regenerateBackupCodes();
      setBackupCodes(response.data.backupCodes);
      setMessage({
        type: 'success',
        text: 'New backup codes generated. Save these in a secure location!',
      });
      await loadTwoFactorStatus();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to regenerate backup codes',
      });
    } finally {
      setLoading2FA(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({
      type: 'success',
      text: 'Copied to clipboard!',
    });
  };

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // TODO: API call to update notifications
      // await api.patch('/api/user/notifications', notificationsData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMessage({
        type: 'success',
        text: 'Notification preferences updated',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update preferences',
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'security' as const, label: 'Security', icon: Lock },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  const getPasswordStrengthColor = (score?: number) => {
    if (!score) return 'bg-gray-200';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-500">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-4 flex items-start ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : message.type === 'warning'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className={`h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0`} />
          ) : (
            <AlertCircle className={`h-5 w-5 ${message.type === 'warning' ? 'text-yellow-600' : 'text-red-600'} mt-0.5 mr-3 flex-shrink-0`} />
          )}
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : message.type === 'warning' ? 'text-yellow-800' : 'text-red-800'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  You'll need to verify your new email address
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company (optional)
                </label>
                <input
                  type="text"
                  value={profileData.company}
                  onChange={(e) =>
                    setProfileData({ ...profileData, company: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-8 max-w-2xl">
              {/* Change Password */}
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Change Password
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Must be at least 12 characters with uppercase, lowercase, number, and special character
                  </p>

                  {/* Password Strength Indicator */}
                  {passwordCheck && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Password Strength</span>
                        <span className="text-sm font-medium text-gray-900">{passwordCheck.strength?.score || 0}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getPasswordStrengthColor(passwordCheck.strength?.score)}`}
                          style={{ width: `${passwordCheck.strength?.score || 0}%` }}
                        />
                      </div>
                      {checkingPassword && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Checking password security...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* 2FA Section */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Smartphone className="w-5 h-5" />
                  Two-Factor Authentication (2FA)
                </h3>

                {!twoFactorEnabled && !qrCode && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Add an extra layer of security to your account by enabling two-factor authentication.
                      You'll need an authenticator app like Google Authenticator or Authy.
                    </p>
                    <button
                      onClick={handleSetup2FA}
                      disabled={loading2FA}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {loading2FA ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Enable 2FA
                        </>
                      )}
                    </button>
                  </div>
                )}

                {qrCode && backupCodes.length > 0 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium mb-2">Step 1: Scan QR Code</p>
                      <p className="text-sm text-blue-700 mb-3">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      <div className="bg-white p-4 rounded-lg inline-block">
                        <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                      </div>
                    </div>

                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 font-medium mb-2">Step 2: Save Backup Codes</p>
                      <p className="text-sm text-yellow-700 mb-3">
                        Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
                      </p>
                      <div className="bg-white p-3 rounded border border-yellow-300">
                        {backupCodes.map((code, idx) => (
                          <div key={idx} className="font-mono text-sm text-gray-900 flex items-center justify-between py-1">
                            <span>{code}</span>
                            <button
                              onClick={() => copyToClipboard(code)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-700 font-medium mb-2">Step 3: Verify Setup</p>
                      <p className="text-sm text-gray-600 mb-3">
                        Enter the 6-digit code from your authenticator app to complete setup
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={totpToken}
                          onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg tracking-wider"
                        />
                        <button
                          onClick={handleVerify2FA}
                          disabled={loading2FA || totpToken.length !== 6}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {loading2FA ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {twoFactorEnabled && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-green-800 font-medium">2FA is enabled</p>
                      </div>
                      <p className="text-sm text-green-700">
                        Your account is protected with two-factor authentication.
                        {backupCodesRemaining > 0 && ` You have ${backupCodesRemaining} backup codes remaining.`}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleRegenerateBackupCodes}
                        disabled={loading2FA}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Regenerate Backup Codes
                      </button>
                    </div>

                    {backupCodes.length > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 font-medium mb-2">New Backup Codes</p>
                        <p className="text-sm text-yellow-700 mb-3">
                          Save these backup codes in a secure location. These replace your old backup codes.
                        </p>
                        <div className="bg-white p-3 rounded border border-yellow-300">
                          {backupCodes.map((code, idx) => (
                            <div key={idx} className="font-mono text-sm text-gray-900 flex items-center justify-between py-1">
                              <span>{code}</span>
                              <button
                                onClick={() => copyToClipboard(code)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-3">
                        Enter your password to disable 2FA
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={twoFactorPassword}
                          onChange={(e) => setTwoFactorPassword(e.target.value)}
                          placeholder="Your password"
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleDisable2FA}
                          disabled={loading2FA || !twoFactorPassword}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {loading2FA ? 'Disabling...' : 'Disable 2FA'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-red-600 mb-4">
                  Danger Zone
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-red-900">Delete Account</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Permanently delete your account and all of your data. This
                        action cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        alert('Account deletion not implemented in this demo')
                      }
                      className="ml-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <form onSubmit={handleNotificationsSubmit} className="space-y-6 max-w-2xl">
              <h3 className="text-lg font-semibold text-gray-900">
                Notification Preferences
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Email Notifications</h4>
                    <p className="text-sm text-gray-500">
                      Receive email notifications for important updates
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsData.emailNotifications}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          emailNotifications: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Deployment Alerts</h4>
                    <p className="text-sm text-gray-500">
                      Get notified when deployments complete or fail
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsData.deploymentAlerts}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          deploymentAlerts: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Usage Alerts</h4>
                    <p className="text-sm text-gray-500">
                      Alerts when you're approaching your plan limits
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsData.usageAlerts}
                      onChange={(e) =>
                        setNotificationsData({
                          ...notificationsData,
                          usageAlerts: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Security Alerts</h4>
                    <p className="text-sm text-gray-500">
                      Important security notifications (always enabled)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationsData.securityAlerts}
                      disabled
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 cursor-not-allowed"></div>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
