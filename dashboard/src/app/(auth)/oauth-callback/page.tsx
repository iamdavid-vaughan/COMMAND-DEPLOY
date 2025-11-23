'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Rocket, CheckCircle, XCircle, Loader } from 'lucide-react';
import Link from 'next/link';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const token = searchParams.get('token');
        const providerParam = searchParams.get('provider');
        const errorParam = searchParams.get('error');
        const needsTerms = searchParams.get('needsTerms');

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setStatus('error');
          return;
        }

        if (!token) {
          setError('No authentication token received. Please try logging in again.');
          setStatus('error');
          return;
        }

        if (providerParam) {
          setProvider(providerParam);
        }

        // Fetch user data with the token
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();

        // Store auth data
        setAuth(userData.user, token);

        setStatus('success');

        // Check if user needs to accept terms
        if (needsTerms === 'true') {
          // Redirect to terms acceptance page after 1 second
          setTimeout(() => {
            router.push('/accept-terms');
          }, 1000);
        } else {
          // Redirect to dashboard after 1 second
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        setStatus('error');
      }
    };

    handleOAuthCallback();
  }, [searchParams, router, setAuth]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Loader className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Completing sign in...</h2>
            <p className="text-gray-600">
              {provider && `Authenticating with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in successful!</h2>
            <p className="text-gray-600 mb-4">
              {provider && `You're now signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
            </p>
            <div className="animate-pulse">
              <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication failed</h2>
            <p className="text-gray-600">{error}</p>
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors text-center"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
            >
              Back to Home
            </Link>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Need help?{' '}
              <a href="mailto:support@focuswithfocal.com" className="text-blue-600 hover:text-blue-700">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
