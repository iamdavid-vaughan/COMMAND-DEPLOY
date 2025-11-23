'use client';

import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, MapPin, Chrome, Globe, Trash2, AlertTriangle, Shield, RefreshCw, Users } from 'lucide-react';

interface Session {
  id: string;
  ipAddress: string;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  isCurrent: boolean;
  // Admin view fields
  userId?: string;
  email?: string;
  name?: string;
  licenseTier?: string;
}

interface SessionsResponse {
  success: boolean;
  sessions: Session[];
  meta: {
    total: number;
    limit?: number;
    suspiciousActivity?: boolean;
    suspiciousReason?: string | null;
    isAdminView?: boolean;
  };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [meta, setMeta] = useState<SessionsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewAllSessions, setViewAllSessions] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Check user role on mount
  useEffect(() => {
    const user = localStorage.getItem('focal_user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserRole(userData.role);
      } catch (e) {
        console.error('Failed to parse user data', e);
      }
    }
  }, []);

  const fetchSessions = async (showAll: boolean = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('focal_auth_token');
      const url = showAll
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/sessions?all=true`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/sessions`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch sessions');

      const data: SessionsResponse = await response.json();
      setSessions(data.sessions);
      setMeta(data.meta);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to load sessions',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(viewAllSessions);
  }, [viewAllSessions]);

  const handleToggleView = () => {
    setViewAllSessions(!viewAllSessions);
  };

  const terminateSession = async (sessionId: string) => {
    setTerminating(sessionId);
    try {
      const token = localStorage.getItem('focal_auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to terminate session');

      setMessage({
        type: 'success',
        text: 'Session terminated successfully',
      });

      // Refresh sessions list
      await fetchSessions();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to terminate session',
      });
    } finally {
      setTerminating(null);
    }
  };

  const terminateAllOther = async () => {
    if (!confirm('Are you sure you want to terminate all other sessions? This will log you out on all other devices.')) {
      return;
    }

    setTerminating('all');
    try {
      const token = localStorage.getItem('focal_auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/all/other`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to terminate sessions');

      const data = await response.json();
      setMessage({
        type: 'success',
        text: data.message,
      });

      // Refresh sessions list
      await fetchSessions();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to terminate sessions',
      });
    } finally {
      setTerminating(null);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Active Sessions
            {meta?.isAdminView && (
              <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium">
                Admin View
              </span>
            )}
          </h1>
          <p className="mt-2 text-gray-600">
            {meta?.isAdminView
              ? 'Viewing all active sessions across all users'
              : 'Manage and monitor your active login sessions across all devices'}
          </p>
        </div>

        {/* Admin Toggle */}
        {userRole === 'super_admin' && (
          <button
            onClick={handleToggleView}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              viewAllSessions
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            {viewAllSessions ? 'View My Sessions' : 'View All Sessions'}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Shield className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
      )}

      {/* Suspicious Activity Warning */}
      {meta?.suspiciousActivity && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-yellow-900 mb-1">Suspicious Activity Detected</h3>
            <p className="text-sm text-yellow-800">{meta.suspiciousReason}</p>
            <button
              onClick={terminateAllOther}
              disabled={terminating === 'all'}
              className="mt-2 text-sm font-medium text-yellow-900 hover:text-yellow-700 underline"
            >
              Terminate all other sessions
            </button>
          </div>
        </div>
      )}

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{meta?.total || 0}</p>
            </div>
            <Monitor className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Session Limit</p>
              <p className="text-2xl font-bold text-gray-900">
                {meta?.limit === -1 ? 'Unlimited' : meta?.limit || 'N/A'}
              </p>
            </div>
            <Shield className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Security Status</p>
              <p className={`text-lg font-bold ${meta?.suspiciousActivity ? 'text-yellow-600' : 'text-green-600'}`}>
                {meta?.suspiciousActivity ? 'Alert' : 'Secure'}
              </p>
            </div>
            <AlertTriangle className={`w-8 h-8 ${meta?.suspiciousActivity ? 'text-yellow-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => fetchSessions(viewAllSessions)}
          disabled={loading}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        {sessions.length > 1 && !meta?.isAdminView && (
          <button
            onClick={terminateAllOther}
            disabled={terminating === 'all'}
            className="px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Terminate All Other Sessions
          </button>
        )}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-white rounded-lg shadow-sm border p-6 ${
                session.isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Device Icon */}
                  <div className="p-3 bg-gray-100 rounded-lg">
                    {getDeviceIcon(session.deviceType)}
                  </div>

                  {/* Session Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {session.browser || 'Unknown'} on {session.os || 'Unknown'}
                      </h3>
                      {session.isCurrent && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Current Session
                        </span>
                      )}
                    </div>

                    {/* Admin View: Show User Info */}
                    {meta?.isAdminView && session.email && (
                      <div className="mb-3 p-2 bg-purple-50 rounded border border-purple-200">
                        <div className="text-sm">
                          <span className="font-medium text-purple-900">{session.email}</span>
                          {session.name && <span className="text-purple-700 ml-2">({session.name})</span>}
                        </div>
                        {session.licenseTier && (
                          <div className="text-xs text-purple-600 mt-1">
                            Tier: <span className="font-medium capitalize">{session.licenseTier}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>IP Address: {session.ipAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span>Device Type: {session.deviceType || 'Unknown'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        <p>Created: {formatDate(session.createdAt)}</p>
                        <p>Last active: {getTimeAgo(session.lastActivity)}</p>
                        <p>Expires: {formatDate(session.expiresAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terminate Button */}
                {!session.isCurrent && (
                  <button
                    onClick={() => terminateSession(session.id)}
                    disabled={terminating === session.id}
                    className="px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    {terminating === session.id ? 'Terminating...' : 'Terminate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
