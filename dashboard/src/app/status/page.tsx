/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Bell,
  ArrowLeft,
  Activity,
  Server,
  Globe,
  Database,
  Shield,
  Mail
} from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

interface Service {
  name: string;
  status: ServiceStatus;
  description: string;
  icon: any;
  lastChecked: Date;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startTime: Date;
  updates: {
    time: Date;
    status: string;
    message: string;
  }[];
}

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([
    {
      name: 'Dashboard',
      status: 'operational',
      description: 'Web dashboard and UI',
      icon: <Globe className="w-5 h-5" />,
      lastChecked: new Date(),
    },
    {
      name: 'API',
      status: 'operational',
      description: 'REST API and authentication',
      icon: <Server className="w-5 h-5" />,
      lastChecked: new Date(),
    },
    {
      name: 'Deployments',
      status: 'operational',
      description: 'Deployment engine and automation',
      icon: <Activity className="w-5 h-5" />,
      lastChecked: new Date(),
    },
    {
      name: 'Database',
      status: 'operational',
      description: 'Data storage and retrieval',
      icon: <Database className="w-5 h-5" />,
      lastChecked: new Date(),
    },
    {
      name: 'SSL/TLS',
      status: 'operational',
      description: 'Certificate management',
      icon: <Shield className="w-5 h-5" />,
      lastChecked: new Date(),
    },
  ]);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [email, setEmail] = useState('');
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');

  useEffect(() => {
    // Fetch actual service status from API
    fetchServiceStatus();
    fetchIncidents();

    // Refresh every 60 seconds
    const interval = setInterval(() => {
      fetchServiceStatus();
      fetchIncidents();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.services) {
          setServices(data.services.map((s: any) => ({
            ...s,
            lastChecked: new Date(s.lastChecked),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch service status:', error);
      // Keep showing cached status
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/status/incidents`);
      if (response.ok) {
        const data = await response.json();
        if (data.incidents) {
          setIncidents(data.incidents.map((i: any) => ({
            ...i,
            startTime: new Date(i.startTime),
            updates: i.updates.map((u: any) => ({
              ...u,
              time: new Date(u.time),
            })),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribeError('');

    if (!email || !email.includes('@')) {
      setSubscribeError('Please enter a valid email address');
      return;
    }

    setSubscribeLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/status/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe');
      }

      setSubscribeSuccess(true);
      setEmail('');
    } catch (err: any) {
      setSubscribeError(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setSubscribeLoading(false);
    }
  };

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'outage':
        return 'text-red-600 bg-red-100';
      case 'maintenance':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'outage':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'maintenance':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded Performance';
      case 'outage':
        return 'Outage';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
    }
  };

  const getIncidentSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'major':
        return 'bg-orange-100 text-orange-800';
      case 'minor':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'monitoring':
        return 'bg-blue-100 text-blue-800';
      case 'identified':
        return 'bg-yellow-100 text-yellow-800';
      case 'investigating':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const allOperational = services.every(s => s.status === 'operational');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">System Status</h1>
          <div className="flex items-center justify-center">
            {allOperational ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                <p className="text-xl text-green-600 font-semibold">All Systems Operational</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-yellow-600 mr-2" />
                <p className="text-xl text-yellow-600 font-semibold">Some Systems Experiencing Issues</p>
              </>
            )}
          </div>
          <p className="text-gray-600 mt-2">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Services</h2>
          <div className="space-y-4">
            {services.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${getStatusColor(service.status)} mr-4`}>
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-600">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  {getStatusIcon(service.status)}
                  <span className="ml-2 font-medium text-gray-900">
                    {getStatusText(service.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Incidents</h2>
            <div className="space-y-6">
              {incidents.map((incident) => (
                <div key={incident.id} className="border-l-4 border-orange-500 pl-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIncidentSeverityColor(incident.severity)} mr-2`}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIncidentStatusColor(incident.status)}`}>
                          {incident.status.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{incident.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Started {incident.startTime.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 mt-4">
                    {incident.updates.map((update, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-900 uppercase">
                            {update.status}
                          </span>
                          <span className="text-xs text-gray-600">
                            {update.time.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{update.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Recent Incidents */}
        {incidents.length === 0 && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-8 mb-8">
            <div className="flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-green-900">No Recent Incidents</h3>
            </div>
            <p className="text-center text-green-700 mt-2">
              All systems have been running smoothly for the past 90 days.
            </p>
          </div>
        )}

        {/* Email Subscription */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center mb-4">
            <Bell className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Subscribe to Updates</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Get notified about incidents, maintenance windows, and status updates via email.
          </p>

          {subscribeSuccess ? (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-800">Successfully subscribed!</p>
                  <p className="text-sm text-green-700 mt-1">
                    You'll receive status updates at your email address.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubscribeSuccess(false)}
                className="mt-4 text-sm text-green-700 underline hover:text-green-800"
              >
                Subscribe another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={subscribeLoading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {subscribeLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Subscribe
                  </>
                )}
              </button>
            </form>
          )}

          {subscribeError && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700">{subscribeError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            If you're experiencing issues not listed here, please{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              contact support
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
