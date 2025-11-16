'use client';

/**
 * Admin Settings Page - Platform configuration management
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { Settings, Save, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

interface PlatformSettings {
  authorizenet: {
    apiLoginId: string | null;
    transactionKey: string | null;
    environment: 'sandbox' | 'production';
    configured: boolean;
  };
  postmark: {
    serverToken: string | null;
    fromEmail: string | null;
    configured: boolean;
  };
  app: {
    url: string;
    environment: string;
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Authorize.Net form state
  const [authnetApiLoginId, setAuthnetApiLoginId] = useState('');
  const [authnetTransactionKey, setAuthnetTransactionKey] = useState('');
  const [authnetEnvironment, setAuthnetEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [showAuthnetKey, setShowAuthnetKey] = useState(false);

  // Postmark form state
  const [postmarkServerToken, setPostmarkServerToken] = useState('');
  const [postmarkFromEmail, setPostmarkFromEmail] = useState('');
  const [showPostmarkToken, setShowPostmarkToken] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getSettings();
      const data = response.data.settings;
      setSettings(data);
      setAuthnetEnvironment(data.authorizenet.environment);
      if (data.postmark.fromEmail) {
        setPostmarkFromEmail(data.postmark.fromEmail);
      }
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      setErrorMessage('Failed to load settings: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAuthorizenet = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authnetApiLoginId.trim() || !authnetTransactionKey.trim()) {
      setErrorMessage('API Login ID and Transaction Key are required');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      await adminAPI.updateAuthorizenet({
        apiLoginId: authnetApiLoginId.trim(),
        transactionKey: authnetTransactionKey.trim(),
        environment: authnetEnvironment,
      });

      setSuccessMessage(`Authorize.Net credentials updated successfully (${authnetEnvironment} mode)`);
      setAuthnetApiLoginId('');
      setAuthnetTransactionKey('');

      // Reload settings to show updated masked values
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to update Authorize.Net settings:', error);
      setErrorMessage('Failed to update Authorize.Net settings: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePostmark = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!postmarkServerToken.trim()) {
      setErrorMessage('Postmark Server Token is required');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      await adminAPI.updatePostmark({
        serverToken: postmarkServerToken.trim(),
        fromEmail: postmarkFromEmail.trim() || undefined,
      });

      setSuccessMessage('Postmark credentials updated successfully');
      setPostmarkServerToken('');

      // Reload settings to show updated masked values
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to update Postmark settings:', error);
      setErrorMessage('Failed to update Postmark settings: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Settings className="h-8 w-8 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500">Configure platform integrations and services</p>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* App Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Environment:</span>
            <span className="font-medium text-gray-900">{settings?.app.environment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">App URL:</span>
            <span className="font-medium text-gray-900">{settings?.app.url}</span>
          </div>
        </div>
      </div>

      {/* Authorize.Net Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Authorize.Net</h2>
            <p className="text-sm text-gray-500">Payment processing credentials</p>
          </div>
          {settings?.authorizenet.configured ? (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Configured</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-orange-600">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Not Configured</span>
            </div>
          )}
        </div>

        {settings?.authorizenet.configured && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Current API Login ID:</span>
              <span className="font-mono text-gray-900">{settings.authorizenet.apiLoginId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Environment:</span>
              <span className="font-medium text-gray-900 uppercase">{settings.authorizenet.environment}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveAuthorizenet} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Login ID
            </label>
            <input
              type="text"
              value={authnetApiLoginId}
              onChange={(e) => setAuthnetApiLoginId(e.target.value)}
              placeholder="Enter API Login ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Key
            </label>
            <div className="relative">
              <input
                type={showAuthnetKey ? 'text' : 'password'}
                value={authnetTransactionKey}
                onChange={(e) => setAuthnetTransactionKey(e.target.value)}
                placeholder="Enter Transaction Key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowAuthnetKey(!showAuthnetKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showAuthnetKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Environment
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="sandbox"
                  checked={authnetEnvironment === 'sandbox'}
                  onChange={(e) => setAuthnetEnvironment(e.target.value as 'sandbox')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Sandbox (Testing)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="production"
                  checked={authnetEnvironment === 'production'}
                  onChange={(e) => setAuthnetEnvironment(e.target.value as 'production')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Production (Live)</span>
              </label>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Credentials will be securely stored in the .env file and never exposed in the codebase.
              Use <strong>Sandbox</strong> for testing and <strong>Production</strong> for live customer payments.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving...' : 'Save Authorize.Net Settings'}</span>
          </button>
        </form>
      </div>

      {/* Postmark Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Postmark</h2>
            <p className="text-sm text-gray-500">Email delivery service credentials</p>
          </div>
          {settings?.postmark.configured ? (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Configured</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-orange-600">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Not Configured</span>
            </div>
          )}
        </div>

        {settings?.postmark.configured && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Current From Email:</span>
              <span className="font-medium text-gray-900">{settings.postmark.fromEmail || 'Not set'}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSavePostmark} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Server Token
            </label>
            <div className="relative">
              <input
                type={showPostmarkToken ? 'text' : 'password'}
                value={postmarkServerToken}
                onChange={(e) => setPostmarkServerToken(e.target.value)}
                placeholder="Enter Postmark Server Token"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPostmarkToken(!showPostmarkToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPostmarkToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Email Address
            </label>
            <input
              type="email"
              value={postmarkFromEmail}
              onChange={(e) => setPostmarkFromEmail(e.target.value)}
              placeholder="noreply@focuswithfocal.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> The server token will be securely stored in the .env file.
              Make sure the From Email is verified in your Postmark account.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving...' : 'Save Postmark Settings'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
