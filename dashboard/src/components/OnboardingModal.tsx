'use client';

import { useState, useEffect } from 'react';
import { X, Check, CreditCard, Rocket, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [hasPayment, setHasPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkPaymentStatus();
    }
  }, [isOpen]);

  const checkPaymentStatus = async () => {
    try {
      const response = await api.get('/api/billing/subscription');
      const subscription = response.data.subscription;
      setHasPayment(subscription && subscription.status === 'active' && !subscription.requiresPayment);
    } catch (error) {
      setHasPayment(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSetupPayment = () => {
    onClose();
    router.push('/dashboard/billing');
  };

  const handleGetStarted = () => {
    onClose();
    router.push('/dashboard/deployments/new');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 relative">
          {/* Only show close button if payment is set up */}
          {hasPayment && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <Rocket className="w-10 h-10" />
            <div>
              <h2 className="text-2xl font-bold">Welcome to Focal Deploy!</h2>
              <p className="text-blue-100 mt-1">Let's get you started in just a few steps</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Payment Required Banner */}
          {!hasPayment && !loading && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Payment Setup Required</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    To create deployments, you'll need to set up a payment method. Your 7-day free trial starts after payment setup.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Step 1: Welcome */}
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Account Created
                  </h3>
                  <p className="text-gray-600">
                    You're signed in as <span className="font-medium">{user?.email}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: Set Up Payment */}
            <div className={`border rounded-lg p-6 ${hasPayment ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPayment ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {hasPayment ? (
                      <Check className="w-6 h-6 text-green-600" />
                    ) : (
                      <span className="font-bold text-blue-600">2</span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {hasPayment ? 'Payment Method Configured' : 'Set Up Payment Method'}
                  </h3>
                  {hasPayment ? (
                    <p className="text-gray-600">
                      Your payment method is configured. You're ready to deploy!
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">
                        Set up your payment method to activate your account and start deploying.
                        Your card won't be charged until after your 7-day free trial.
                      </p>
                      <button
                        onClick={handleSetupPayment}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Set Up Payment
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Deploy */}
            <div className={`border rounded-lg p-6 ${hasPayment ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPayment ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {hasPayment ? (
                      <span className="font-bold text-green-600">3</span>
                    ) : (
                      <span className="font-bold text-gray-400">3</span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Create Your First Deployment
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {hasPayment
                      ? 'Deploy your application to the cloud in minutes with our guided setup.'
                      : 'Complete payment setup to unlock deployments.'
                    }
                  </p>
                  {hasPayment && (
                    <>
                      <ul className="space-y-2 mb-4">
                        <li className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-green-600" />
                          Connect your cloud provider (AWS, GCP, DigitalOcean)
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-green-600" />
                          Configure your application settings
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-green-600" />
                          Deploy with one click
                        </li>
                      </ul>
                      <button
                        onClick={handleGetStarted}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Rocket className="w-4 h-4" />
                        Start Deploying
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            {hasPayment ? (
              <div className="flex justify-between items-center">
                <button
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  Skip for now
                </button>
                <p className="text-sm text-gray-500">
                  You can access these steps anytime from your dashboard
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">
                Payment setup is required to create deployments.
                <span className="block mt-1 text-gray-400">
                  Your card will only be charged after your 7-day free trial ends.
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
