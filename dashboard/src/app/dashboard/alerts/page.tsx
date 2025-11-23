/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Edit, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api, { deploymentsAPI } from '@/lib/api';

interface AlertRule {
  id: number;
  deployment_id: number;
  deployment_name: string;
  rule_name: string;
  rule_type: 'cpu' | 'ram' | 'disk' | 'app_down' | 'ssl_expiring';
  comparison: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  enabled: boolean;
  last_triggered_at?: Date;
  triggered_count: number;
}

interface Deployment {
  id: number;
  name: string;
  project_name: string;
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    deployment_id: string;
    rule_name: string;
    rule_type: 'cpu' | 'ram' | 'disk' | 'app_down' | 'ssl_expiring';
    comparison: 'greater_than' | 'less_than' | 'equals';
    threshold: number;
    enabled: boolean;
  }>({
    deployment_id: '',
    rule_name: '',
    rule_type: 'cpu',
    comparison: 'greater_than',
    threshold: 80,
    enabled: true
  });

  useEffect(() => {
    fetchAlertRules();
    fetchDeployments();
  }, []);

  const fetchAlertRules = async () => {
    try {
      const response = await api.get('/api/alerts/rules');
      setRules(response.data.rules || []);
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await deploymentsAPI.list({});
      setDeployments(response.data.deployments || []);
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingRule) {
        await api.put(`/api/alerts/rules/${editingRule.id}`, formData);
      } else {
        await api.post('/api/alerts/rules', formData);
      }

      setShowModal(false);
      setEditingRule(null);
      setFormData({
        deployment_id: '',
        rule_name: '',
        rule_type: 'cpu',
        comparison: 'greater_than',
        threshold: 80,
        enabled: true
      });
      fetchAlertRules();
    } catch (error: any) {
      console.error('Failed to save alert rule:', error);
      setError(error.response?.data?.message || 'Failed to save alert rule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;

    try {
      await api.delete(`/api/alerts/rules/${id}`);
      fetchAlertRules();
    } catch (error) {
      console.error('Failed to delete alert rule:', error);
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    try {
      await api.put(`/api/alerts/rules/${rule.id}`, {
        ...rule,
        enabled: !rule.enabled
      });
      fetchAlertRules();
    } catch (error) {
      console.error('Failed to toggle alert rule:', error);
    }
  };

  const openEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      deployment_id: String(rule.deployment_id),
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      comparison: rule.comparison,
      threshold: rule.threshold,
      enabled: rule.enabled
    });
    setShowModal(true);
  };

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cpu: 'CPU Usage',
      ram: 'Memory Usage',
      disk: 'Disk Usage',
      app_down: 'Application Down',
      ssl_expiring: 'SSL Expiring'
    };
    return labels[type] || type;
  };

  const getComparisonLabel = (comparison: string) => {
    const labels: Record<string, string> = {
      greater_than: '>',
      less_than: '<',
      equals: '='
    };
    return labels[comparison] || comparison;
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-gray-600 mt-1">Configure alerts for your deployments</p>
        </div>
        <button
          onClick={() => {
            setEditingRule(null);
            setFormData({
              deployment_id: '',
              rule_name: '',
              rule_type: 'cpu',
              comparison: 'greater_than',
              threshold: 80,
              enabled: true
            });
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Alert Rule
        </button>
      </div>

      {/* Alert Rules List */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Alert Rules Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first alert rule to get notified about deployment issues
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Alert Rule
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deployment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule.id} className={!rule.enabled ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.enabled ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Disabled
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{rule.rule_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{rule.deployment_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-medium">{getRuleTypeLabel(rule.rule_type)}</span>
                      {rule.rule_type !== 'app_down' && rule.rule_type !== 'ssl_expiring' && (
                        <>
                          {' '}{getComparisonLabel(rule.comparison)} {rule.threshold}%
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {rule.triggered_count > 0 ? (
                      <div>
                        {rule.triggered_count}x
                        {rule.last_triggered_at && (
                          <div className="text-xs text-gray-400">
                            Last: {new Date(rule.last_triggered_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deployment
                </label>
                <select
                  value={formData.deployment_id}
                  onChange={(e) => setFormData({ ...formData, deployment_id: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  required
                >
                  <option value="">Select deployment...</option>
                  {deployments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.project_name || d.name || `Deployment ${d.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., High CPU Alert"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metric Type
                </label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  required
                >
                  <option value="cpu">CPU Usage</option>
                  <option value="ram">Memory Usage</option>
                  <option value="disk">Disk Usage</option>
                  <option value="app_down">Application Down</option>
                  <option value="ssl_expiring">SSL Expiring</option>
                </select>
              </div>

              {formData.rule_type !== 'app_down' && formData.rule_type !== 'ssl_expiring' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condition
                    </label>
                    <select
                      value={formData.comparison}
                      onChange={(e) => setFormData({ ...formData, comparison: e.target.value as any })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      required
                    >
                      <option value="greater_than">Greater than</option>
                      <option value="less_than">Less than</option>
                      <option value="equals">Equals</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Threshold (%)
                    </label>
                    <input
                      type="number"
                      value={formData.threshold}
                      onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      min="0"
                      max="100"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                  Enable this alert rule
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingRule(null);
                    setError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  disabled={submitting}
                >
                  {submitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {submitting ? 'Saving...' : (editingRule ? 'Update' : 'Create') + ' Alert Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
