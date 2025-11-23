/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Database, Server, Globe, Mail } from 'lucide-react';

interface SystemAlert {
  id: string;
  type: 'database' | 'api' | 'email' | 'deployment_worker' | 'disk_space' | 'memory';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value?: string;
  threshold?: string;
  timestamp: Date;
  resolved: boolean;
}

export default function SystemAlertsPage() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0
  });

  useEffect(() => {
    fetchSystemAlerts();
    const interval = setInterval(fetchSystemAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemAlerts = async () => {
    try {
      const response = await fetch('/api/admin/system-alerts', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();

      if (data.success) {
        setAlerts(data.alerts || []);
        setStats(data.stats || { total: 0, critical: 0, warning: 0, info: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch system alerts:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-500';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-500';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-500';
      default: return 'bg-gray-100 text-gray-800 border-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'database': return <Database className="w-5 h-5" />;
      case 'api': return <Server className="w-5 h-5" />;
      case 'email': return <Mail className="w-5 h-5" />;
      case 'deployment_worker': return <Globe className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Shield className="w-8 h-8 mr-3 text-blue-600" />
          System Alerts
        </h1>
        <p className="text-gray-600 mt-1">Focal Deploy platform monitoring and alerts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600">Total Alerts</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="text-sm text-red-600">Critical</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stats.critical}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
          <div className="text-sm text-yellow-600">Warning</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{stats.warning}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="text-sm text-blue-600">Info</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.info}</div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Systems Operational</h3>
            <p className="text-gray-600">No active system alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg shadow-sm border-l-4 p-6 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getTypeIcon(alert.type)}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {alert.type.replace('_', ' ')}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-1">{alert.message}</p>
                    {alert.value && alert.threshold && (
                      <div className="mt-2 text-sm text-gray-600">
                        Current: <span className="font-medium">{alert.value}</span> |
                        Threshold: <span className="font-medium">{alert.threshold}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                {alert.resolved && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                    RESOLVED
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* System Health Checks */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Monitored Systems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'PostgreSQL Database', status: 'operational' },
            { name: 'Redis Cache', status: 'operational' },
            { name: 'API Server', status: 'operational' },
            { name: 'Deployment Worker', status: 'operational' },
            { name: 'Email Service (Postmark)', status: 'operational' },
            { name: 'Disk Space', status: 'operational' },
          ].map((system) => (
            <div key={system.name} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                system.status === 'operational' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-700">{system.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
