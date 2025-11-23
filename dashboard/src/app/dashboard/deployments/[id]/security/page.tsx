/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Lock,
  Key,
  Activity,
  AlertCircle
} from 'lucide-react';

interface SecurityAudit {
  firewall: { status: string; message: string };
  fail2ban: { status: string; message: string };
  sshHardening: { status: string; message: string };
  updates: { status: string; message: string; count?: number };
}

interface FirewallInfo {
  status: string;
  logging: string;
  defaultIncoming: string;
  defaultOutgoing: string;
  rules: string;
  rawOutput: string;
}

interface Fail2banInfo {
  installed: boolean;
  active: boolean;
  jails: Array<{
    jail: string;
    enabled: boolean;
    bannedCount: number;
    bannedIPs: string[];
  }>;
  totalBanned: number;
}

interface SSHInfo {
  port: string;
  permitRootLogin: string;
  passwordAuthentication: string;
  pubkeyAuthentication: string;
  port22SecurityGroup: string;
  securityScore: number;
  hardened: boolean;
}

export default function SecurityDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<SecurityAudit | null>(null);
  const [overallScore, setOverallScore] = useState(0);
  const [grade, setGrade] = useState('');
  const [firewall, setFirewall] = useState<FirewallInfo | null>(null);
  const [fail2ban, setFail2ban] = useState<Fail2banInfo | null>(null);
  const [ssh, setSSH] = useState<SSHInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'firewall' | 'fail2ban' | 'ssh'>('audit');

  useEffect(() => {
    fetchSecurityData();
  }, [deploymentId]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAudit(),
        fetchFirewall(),
        fetchFail2ban(),
        fetchSSH()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const response = await fetch(`/api/security/${deploymentId}/audit`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setAudit(data.audit);
        setOverallScore(data.overallScore);
        setGrade(data.grade);
      }
    } catch (error) {
      console.error('Failed to fetch audit:', error);
    }
  };

  const fetchFirewall = async () => {
    try {
      const response = await fetch(`/api/security/${deploymentId}/firewall`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setFirewall(data.firewall);
      }
    } catch (error) {
      console.error('Failed to fetch firewall:', error);
    }
  };

  const fetchFail2ban = async () => {
    try {
      const response = await fetch(`/api/security/${deploymentId}/fail2ban`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setFail2ban(data.fail2ban);
      }
    } catch (error) {
      console.error('Failed to fetch fail2ban:', error);
    }
  };

  const fetchSSH = async () => {
    try {
      const response = await fetch(`/api/security/${deploymentId}/ssh`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setSSH(data.ssh);
      }
    } catch (error) {
      console.error('Failed to fetch SSH:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 border-green-500';
      case 'B': return 'text-blue-600 bg-blue-100 border-blue-500';
      case 'C': return 'text-yellow-600 bg-yellow-100 border-yellow-500';
      case 'D': return 'text-red-600 bg-red-100 border-red-500';
      default: return 'text-gray-600 bg-gray-100 border-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/dashboard/deployments/${deploymentId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Shield className="w-8 h-8 mr-3 text-blue-600" />
              Security Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Firewall, Fail2ban, SSH Configuration & Security Audit</p>
          </div>
        </div>
        <button
          onClick={fetchSecurityData}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Overall Security Score */}
      {audit && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Overall Security Score</h2>
              <p className="text-gray-600">Comprehensive security assessment of your deployment</p>
            </div>
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 px-6 py-3 rounded-lg border-2 ${getGradeColor(grade)}`}>
                {grade}
              </div>
              <div className="text-2xl font-semibold text-gray-700">{overallScore}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'audit', label: 'Security Audit', icon: Shield },
            { key: 'firewall', label: 'Firewall (UFW)', icon: Lock },
            { key: 'fail2ban', label: 'Fail2ban', icon: AlertTriangle },
            { key: 'ssh', label: 'SSH Config', icon: Key }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'audit' && audit && (
        <div className="space-y-4">
          {Object.entries(audit).map(([key, item]) => (
            <div key={key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start space-x-3">
                {getStatusIcon(item.status)}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 capitalize mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-gray-600">{item.message}</p>
                  {key === 'updates' && item.count !== undefined && item.count > 0 && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ⚠️ {item.count} security updates available
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'firewall' && firewall && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div className={`font-semibold text-lg capitalize ${
                  firewall.status === 'active' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {firewall.status}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Logging</div>
                <div className="font-semibold text-lg capitalize">{firewall.logging}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Default Incoming</div>
                <div className={`font-semibold text-lg capitalize ${
                  firewall.defaultIncoming === 'deny' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {firewall.defaultIncoming}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Default Outgoing</div>
                <div className="font-semibold text-lg capitalize">{firewall.defaultOutgoing}</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Firewall Rules</h3>
              <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                {firewall.rules || 'No rules configured'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fail2ban' && fail2ban && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div className={`font-semibold text-lg ${
                  fail2ban.active ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {fail2ban.active ? 'Active' : fail2ban.installed ? 'Inactive' : 'Not Installed'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Banned IPs</div>
                <div className="font-semibold text-2xl text-red-600">{fail2ban.totalBanned}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Active Jails</div>
                <div className="font-semibold text-lg">{fail2ban.jails.length}</div>
              </div>
            </div>
            {fail2ban.jails.map((jail) => (
              <div key={jail.jail} className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Jail: {jail.jail}</h3>
                <div className="text-sm text-gray-600 mb-2">
                  Banned IPs: {jail.bannedCount}
                </div>
                {jail.bannedIPs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {jail.bannedIPs.map((ip) => (
                      <span key={ip} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">
                        {ip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ssh' && ssh && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">SSH Security Score</h3>
                <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${
                  ssh.securityScore >= 75 ? 'text-green-600 bg-green-100' :
                  ssh.securityScore >= 50 ? 'text-yellow-600 bg-yellow-100' :
                  'text-red-600 bg-red-100'
                }`}>
                  {ssh.securityScore}%
                </div>
              </div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                ssh.hardened ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {ssh.hardened ? '✓ SSH Hardened' : '⚠️ SSH Not Fully Hardened'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">SSH Port</div>
                <div className={`font-semibold text-lg font-mono ${
                  ssh.port !== '22' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {ssh.port}
                </div>
                {ssh.port === '22' && (
                  <div className="text-xs text-yellow-600 mt-1">⚠️ Using default port</div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Root Login</div>
                <div className={`font-semibold text-lg ${
                  ssh.permitRootLogin === 'no' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {ssh.permitRootLogin}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Password Authentication</div>
                <div className={`font-semibold text-lg ${
                  ssh.passwordAuthentication === 'no' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {ssh.passwordAuthentication}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Public Key Auth</div>
                <div className={`font-semibold text-lg ${
                  ssh.pubkeyAuthentication === 'yes' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {ssh.pubkeyAuthentication}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg col-span-full">
                <div className="text-sm text-gray-600 mb-1">Port 22 in Security Group</div>
                <div className={`font-semibold text-lg ${
                  ssh.port22SecurityGroup === 'closed' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {ssh.port22SecurityGroup}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
