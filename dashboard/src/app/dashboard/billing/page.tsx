'use client';

import { useEffect, useState } from 'react';
import { billingAPI } from '@/lib/api';
import {
  CreditCard,
  CheckCircle,
  Calendar,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Download,
  Edit,
  XCircle,
} from 'lucide-react';

interface Subscription {
  id: string;
  plan: string;
  billingCycle: string;
  amount: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  paidAt?: string;
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    deploymentsPerMonth: number;
    maxInstances: number;
    maxS3Buckets: number;
    maxDomains: number;
    teamMembers: number;
    support: string;
  };
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subscriptionResponse, invoicesResponse, plansResponse] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getInvoices(),
        billingAPI.getPlans(),
      ]);

      setSubscription(subscriptionResponse.data.subscription);
      setInvoices(invoicesResponse.data.invoices || []);
      setPlans(plansResponse.data.plans || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch billing data:', err);
      setError(err.response?.data?.message || 'Failed to load billing information');
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel your subscription? You will have access until the end of your current billing period.'
      )
    ) {
      return;
    }

    try {
      await billingAPI.cancelSubscription();
      alert('Subscription cancelled successfully');
      fetchBillingData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'past_due':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPlanDisplayName = (planId: string) => {
    const planNames: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      max: 'Max',
      enterprise: 'Enterprise',
    };
    return planNames[planId] || planId;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription, payment method, and view invoices
          </p>
        </div>
      </div>

      {/* Current Subscription Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Current Subscription
          </h2>
        </div>

        {subscription ? (
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Plan Info */}
              <div>
                <div className="flex items-center mb-2">
                  {getStatusIcon(subscription.status)}
                  <span className="ml-2 text-sm font-medium text-gray-500">Status</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {getPlanDisplayName(subscription.plan)}
                </p>
                <p className="text-sm text-gray-500 capitalize">{subscription.billingCycle}</p>
              </div>

              {/* Billing Amount */}
              <div>
                <div className="flex items-center mb-2">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  <span className="ml-2 text-sm font-medium text-gray-500">Amount</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(subscription.amount)}
                </p>
                <p className="text-sm text-gray-500">
                  per {subscription.billingCycle === 'monthly' ? 'month' : 'year'}
                </p>
              </div>

              {/* Next Billing Date */}
              <div>
                <div className="flex items-center mb-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="ml-2 text-sm font-medium text-gray-500">
                    {subscription.status === 'cancelled' ? 'Access Until' : 'Next Billing'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
                <p className="text-sm text-gray-500">
                  {subscription.status === 'cancelled' ? 'Cancelled' : 'Auto-renew'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex space-x-3">
              {subscription.status === 'active' && (
                <>
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Change Plan
                  </button>
                  <button
                    onClick={() => setShowPaymentMethod(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Update Payment Method
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Subscription
                  </button>
                </>
              )}
              {subscription.status === 'cancelled' && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Reactivate Subscription
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active subscription</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started with a plan to access all features
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowUpgrade(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                View Plans
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Billing History</h2>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Billing Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.paidAt ? formatDate(invoice.paidAt) : formatDate(invoice.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900 flex items-center ml-auto">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-500">No invoices yet</p>
          </div>
        )}
      </div>

      {/* Upgrade Modal Placeholder */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Change Plan</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Plan upgrade/downgrade functionality will be available soon.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal Placeholder */}
      {showPaymentMethod && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Update Payment Method</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Payment method update functionality will be available soon.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={() => setShowPaymentMethod(false)}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
