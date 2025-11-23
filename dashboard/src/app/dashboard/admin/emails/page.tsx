'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  template_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ScheduledEmail {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  error_message: string | null;
  user_email: string;
  first_name: string;
  last_name: string;
  template_name: string | null;
  sequence_name: string | null;
}

interface EmailStats {
  overall: {
    sent: number;
    pending: number;
    failed: number;
    cancelled: number;
  };
  engagement: {
    total_tracked: number;
    opened: number;
    clicked: number;
    bounced: number;
    spam: number;
  };
  templates: Array<{
    template_name: string;
    sent_count: number;
    opens: number;
    clicks: number;
  }>;
}

export default function EmailManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'stats' | 'templates' | 'scheduled' | 'send'>('stats');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Send email form state
  const [sendForm, setSendForm] = useState({
    to: '',
    subject: '',
    html_body: '',
    text_body: '',
    template_id: '',
    user_id: ''
  });
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'stats') {
        const response = await api.get('/api/admin/emails/stats?days=30');
        setStats(response.data);
      } else if (activeTab === 'templates') {
        const response = await api.get('/api/admin/emails/templates');
        setTemplates(response.data.templates);
      } else if (activeTab === 'scheduled') {
        const response = await api.get('/api/admin/emails/scheduled?limit=100');
        setScheduledEmails(response.data.emails);
      } else if (activeTab === 'send') {
        // Load templates for template selector
        const response = await api.get('/api/admin/emails/templates');
        setTemplates(response.data.templates);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
      console.error('Error loading email data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendLoading(true);
    setSendSuccess(false);

    try {
      await api.post('/api/admin/emails/send', sendForm);
      setSendSuccess(true);

      // Reset form
      setSendForm({
        to: '',
        subject: '',
        html_body: '',
        text_body: '',
        template_id: '',
        user_id: ''
      });

      // Reload scheduled emails if on that tab
      if (activeTab === 'scheduled') {
        loadData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send email');
      console.error('Error sending email:', err);
    } finally {
      setSendLoading(false);
    }
  };

  const handleTestEmail = async (templateId: string) => {
    try {
      await api.post('/api/admin/emails/test', { template_id: templateId });
      alert('Test email sent successfully!');
    } catch (err: any) {
      alert('Failed to send test email: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Email Management</h1>
          <p className="mt-2 text-gray-600">Manage email templates, sequences, and view delivery statistics</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('stats')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'scheduled'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setActiveTab('send')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'send'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Send Email
            </button>
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Statistics Tab */}
        {!loading && activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Sent</h3>
                <p className="mt-2 text-3xl font-bold text-green-600">{stats.overall.sent}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Pending</h3>
                <p className="mt-2 text-3xl font-bold text-yellow-600">{stats.overall.pending}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Failed</h3>
                <p className="mt-2 text-3xl font-bold text-red-600">{stats.overall.failed}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Cancelled</h3>
                <p className="mt-2 text-3xl font-bold text-gray-600">{stats.overall.cancelled}</p>
              </div>
            </div>

            {/* Engagement Stats */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Tracked</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.engagement.total_tracked}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Opened</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.engagement.opened}</p>
                  {stats.engagement.total_tracked > 0 && (
                    <p className="text-xs text-gray-500">
                      {((stats.engagement.opened / stats.engagement.total_tracked) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Clicked</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.engagement.clicked}</p>
                  {stats.engagement.total_tracked > 0 && (
                    <p className="text-xs text-gray-500">
                      {((stats.engagement.clicked / stats.engagement.total_tracked) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bounced</p>
                  <p className="text-2xl font-bold text-red-600">{stats.engagement.bounced}</p>
                  {stats.engagement.total_tracked > 0 && (
                    <p className="text-xs text-gray-500">
                      {((stats.engagement.bounced / stats.engagement.total_tracked) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Spam</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.engagement.spam}</p>
                  {stats.engagement.total_tracked > 0 && (
                    <p className="text-xs text-gray-500">
                      {((stats.engagement.spam / stats.engagement.total_tracked) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Template Performance */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Template
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Opens
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clicks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Open Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.templates.map((template, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {template.template_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {template.sent_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {template.opens}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {template.clicks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {template.sent_count > 0
                            ? ((template.opens / template.sent_count) * 100).toFixed(1)
                            : '0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {!loading && activeTab === 'templates' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {template.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {template.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.template_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(template.is_active ? 'active' : 'inactive')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleTestEmail(template.id)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Send Test
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Scheduled Emails Tab */}
        {!loading && activeTab === 'scheduled' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled For
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scheduledEmails.map((email) => (
                  <tr key={email.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{email.to_email}</div>
                      <div className="text-sm text-gray-500">
                        {email.first_name} {email.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {email.subject}
                      {email.template_name && (
                        <div className="text-xs text-gray-400">Template: {email.template_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(email.status)}
                      {email.error_message && (
                        <div className="text-xs text-red-500 mt-1">{email.error_message}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(email.scheduled_for)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {email.sent_at ? formatDate(email.sent_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Send Email Tab */}
        {!loading && activeTab === 'send' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Send Email</h3>

            {sendSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800">Email sent successfully!</p>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Template (Optional)
                </label>
                <select
                  value={sendForm.template_id}
                  onChange={(e) => setSendForm({ ...sendForm, template_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Custom Email --</option>
                  {templates.filter(t => t.is_active).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email *
                </label>
                <input
                  type="email"
                  required
                  value={sendForm.to}
                  onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                />
              </div>

              {!sendForm.template_id && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required={!sendForm.template_id}
                      value={sendForm.subject}
                      onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Email subject"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HTML Body *
                    </label>
                    <textarea
                      required={!sendForm.template_id}
                      value={sendForm.html_body}
                      onChange={(e) => setSendForm({ ...sendForm, html_body: e.target.value })}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="<html>...</html>"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Text Body (Optional)
                    </label>
                    <textarea
                      value={sendForm.text_body}
                      onChange={(e) => setSendForm({ ...sendForm, text_body: e.target.value })}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Plain text version"
                    />
                  </div>
                </>
              )}

              <div>
                <button
                  type="submit"
                  disabled={sendLoading}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {sendLoading ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
