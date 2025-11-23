/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Terminal,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Server,
  Globe,
  Clock
} from 'lucide-react';

interface DeploymentLog {
  level: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface DeploymentInfo {
  id: number;
  project_name: string;
  status: string;
  started_at?: Date;
  completed_at?: Date;
  public_ip?: string;
  instance_id?: string;
  error_message?: string;
}

export default function LiveDeploymentPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = parseInt(params.id as string);

  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch initial deployment data and logs
  useEffect(() => {
    fetchDeploymentData();
    fetchDeploymentLogs();
  }, [deploymentId]);

  // Setup WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Connect to WebSocket
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      socket.emit('join_deployment', deploymentId);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('joined_deployment', (data) => {
      console.log('Joined deployment room:', data);
    });

    socket.on('deployment_status', (data) => {
      console.log('Status update:', data);
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? { ...prev, status: data.status } : null);
      }
    });

    socket.on('deployment_log', (data) => {
      console.log('New log:', data);
      if (data.deploymentId === deploymentId) {
        setLogs(prev => [...prev, data.log]);
      }
    });

    socket.on('deployment_complete', (data) => {
      console.log('Deployment complete:', data);
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? {
          ...prev,
          status: 'completed',
          public_ip: data.result.publicIp,
          instance_id: data.result.instanceId,
          completed_at: new Date()
        } : null);
      }
    });

    socket.on('deployment_error', (data) => {
      console.log('Deployment error:', data);
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? {
          ...prev,
          status: 'failed',
          error_message: data.error.message,
          completed_at: new Date()
        } : null);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    return () => {
      socket.emit('leave_deployment', deploymentId);
      socket.disconnect();
    };
  }, [deploymentId, router]);

  const fetchDeploymentData = async () => {
    try {
      const response = await fetch(`/api/deployments/${deploymentId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDeployment(data.deployment);
      }
    } catch (error) {
      console.error('Failed to fetch deployment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeploymentLogs = async () => {
    try {
      const response = await fetch(`/api/logs/deployment/${deploymentId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'running':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-500';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-500';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-500';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-500';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      case 'info':
      default:
        return 'text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Deployment Not Found</h2>
          <p className="text-gray-600 mb-4">The deployment you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/dashboard/deployments')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Deployments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/deployments')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Terminal className="w-8 h-8 mr-3 text-blue-600" />
              Live Deployment
            </h1>
            <p className="text-gray-600 mt-1">{deployment.project_name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-600' : 'bg-gray-600'}`} />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Deployment Status */}
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 ${getStatusColor(deployment.status)}`}>
            {getStatusIcon(deployment.status)}
            <span className="font-semibold uppercase">{deployment.status}</span>
          </div>
        </div>
      </div>

      {/* Deployment Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Server className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-gray-600">Instance ID</div>
          </div>
          <div className="font-mono text-sm text-gray-900">
            {deployment.instance_id || 'Not created yet'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-gray-600">Public IP</div>
          </div>
          <div className="font-mono text-sm text-gray-900">
            {deployment.public_ip || 'Not assigned yet'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <div className="text-sm text-gray-600">Duration</div>
          </div>
          <div className="font-medium text-gray-900">
            {deployment.started_at ? (
              <>
                {deployment.completed_at ? (
                  Math.round((new Date(deployment.completed_at).getTime() - new Date(deployment.started_at).getTime()) / 1000 / 60)
                ) : (
                  Math.round((Date.now() - new Date(deployment.started_at).getTime()) / 1000 / 60)
                )} minutes
              </>
            ) : 'Not started'}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {deployment.error_message && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Deployment Failed</h3>
              <p className="text-red-700 text-sm">{deployment.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Live Logs */}
      <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5 text-green-400" />
            <span className="text-gray-200 font-semibold">Live Deployment Logs</span>
          </div>
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>

        <div className="p-4 h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No logs yet. Waiting for deployment to start...</p>
              </div>
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div key={index} className="mb-1 flex items-start space-x-2">
                  <span className="text-gray-500 text-xs mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`${getLogLevelColor(log.level)} flex-1`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {deployment.status === 'running' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Deployment in Progress</h3>
              <p className="text-blue-700 text-sm">
                This page will automatically update as the deployment progresses. Do not close this page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {deployment.status === 'completed' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-1">Deployment Completed Successfully!</h3>
              <p className="text-green-700 text-sm mb-3">
                Your application has been deployed and is now running.
              </p>
              {deployment.public_ip && (
                <div className="flex items-center space-x-3">
                  <a
                    href={`http://${deployment.public_ip}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Visit Application
                  </a>
                  <button
                    onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
                    className="inline-flex items-center px-4 py-2 bg-white border border-green-600 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium"
                  >
                    View Deployment Details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
