'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function HomePage() {
  const router = useRouter();
  const { user, isInitialized, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, []); // Only run once on mount

  useEffect(() => {
    // Only redirect after auth has been initialized
    if (!isInitialized) return;

    // Redirect based on auth status
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [user, isInitialized, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
