'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Terminal as TerminalIcon,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import api from '@/lib/api';

// Dynamically import Terminal component (client-side only)
const Terminal = dynamic(() => import('@/components/Terminal'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] rounded-lg">
      <div className="text-white">Loading terminal...</div>
    </div>
  )
});

interface Deployment {
  id: string;
  projectName: string;
  publicIp: string | null;
  status: string;
  configuration?: {
    sshPort?: number;
    deploymentUsername?: string;
  };
}

export default function TerminalPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Memoize callbacks to prevent Terminal re-renders
  const handleConnectionStatusChange = useCallback((status: boolean) => {
    setConnected(status);
  }, []);

  const handleError = useCallback((err: string) => {
    console.error('Terminal error:', err);
    setError(err);
  }, []);

  useEffect(() => {
    fetchDeploymentAndAuth();
  }, [deploymentId]);

  const fetchDeploymentAndAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch deployment details
      const deploymentResponse = await api.get(`/api/deployments/${deploymentId}`);
      const deploymentData = deploymentResponse.data.deployment;
      setDeployment(deploymentData);

      if (!deploymentData.publicIp) {
        setError('Deployment does not have a public IP address');
        setLoading(false);
        return;
      }

      // Get terminal auth token
      const authResponse = await api.post('/api/terminal/auth', {
        deploymentId
      });

      setAuthToken(authResponse.data.token);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to initialize terminal:', err);
      setError(err.response?.data?.message || 'Failed to initialize terminal');
      setLoading(false);
    }
  };

  const handleReconnect = () => {
    setAuthToken(null);
    setError(null);
    fetchDeploymentAndAuth();
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing terminal...</p>
        </div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/deployments/${deploymentId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deployment
        </Link>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <XCircle className="w-6 h-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Terminal Error</h3>
              <p className="text-red-700">{error || 'Failed to load deployment'}</p>
              <button
                onClick={handleReconnect}
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  const terminalContent = (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {!fullscreen && (
              <Link
                href={`/dashboard/deployments/${deploymentId}`}
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            )}
            <div className="flex items-center space-x-2">
              <TerminalIcon className="w-5 h-5 text-gray-700" />
              <h1 className="text-xl font-bold text-gray-900">{deployment.projectName}</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection status */}
            <div className="flex items-center space-x-2">
              {connected ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-yellow-600 font-medium">Connecting...</span>
                </>
              )}
            </div>

            {/* Reconnect button */}
            <button
              onClick={handleReconnect}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              title="Reconnect"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Connection info */}
        <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
          <span>IP: {deployment.publicIp}</span>
          <span>•</span>
          <span>Port: {deployment.configuration?.sshPort || 22}</span>
          <span>•</span>
          <span>User: {deployment.configuration?.deploymentUsername || 'ubuntu'}</span>
        </div>
      </div>

      {/* Terminal */}
      <div className={`${fullscreen ? 'h-[calc(100vh-80px)]' : 'h-[600px]'} bg-[#1e1e1e]`}>
        <Terminal
          deploymentId={deploymentId}
          token={authToken}
          onConnectionStatusChange={handleConnectionStatusChange}
          onError={handleError}
        />
      </div>

      {/* Info banner */}
      {!fullscreen && (
        <div className="bg-blue-50 border border-blue-200 rounded-b-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Terminal Tips:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Use Ctrl+C to interrupt running commands</li>
                <li>Use Ctrl+D or type 'exit' to close the session</li>
                <li>The terminal supports copy/paste (Ctrl+Shift+C / Ctrl+Shift+V)</li>
                <li>Click the fullscreen icon for a better experience</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        {terminalContent}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {terminalContent}
    </div>
  );
}
