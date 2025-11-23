'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Rocket, Check, ExternalLink, Loader } from 'lucide-react';
import api from '@/lib/api';

export default function AcceptTermsPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if no user is logged in
  if (!user || !token) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  const handleAcceptTerms = async () => {
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service, Privacy Policy, EULA, and Acceptable Use Policy to continue');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/api/user/accept-terms');

      if (response.data.success) {
        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Failed to accept terms:', err);
      setError(err.response?.data?.message || 'Failed to accept terms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Rocket className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Focal Deploy!</h1>
            <p className="text-gray-600 mt-2">
              Before you continue, please review and accept our terms.
            </p>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Signed in as <span className="font-medium text-gray-900">{user.email}</span>
            </p>
          </div>

          {/* Legal Documents */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Please review the following:</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="flex items-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="flex items-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/eula"
                  target="_blank"
                  className="flex items-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  End User License Agreement (EULA)
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/aup"
                  target="_blank"
                  className="flex items-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Acceptable Use Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Terms Checkbox */}
          <div className="mb-6">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  setError('');
                }}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">
                I have read and agree to the{' '}
                <Link href="/legal/terms" target="_blank" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>
                ,{' '}
                <Link href="/legal/privacy" target="_blank" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
                ,{' '}
                <Link href="/legal/eula" target="_blank" className="text-blue-600 hover:underline">
                  EULA
                </Link>
                , and{' '}
                <Link href="/legal/aup" target="_blank" className="text-blue-600 hover:underline">
                  Acceptable Use Policy
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleAcceptTerms}
            disabled={loading || !agreedToTerms}
            className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Accept & Continue
              </>
            )}
          </button>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing, you acknowledge that you have read and understood our policies.
          </p>
        </div>
      </div>
    </div>
  );
}
