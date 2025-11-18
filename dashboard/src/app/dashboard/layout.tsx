'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  Rocket,
  Key,
  BarChart3,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  AlertCircle,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isInitialized, logout, initAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false);

  useEffect(() => {
    initAuth();
  }, []); // Only run once on mount

  useEffect(() => {
    // Only redirect after auth has been initialized
    if (!isInitialized) return;

    if (!user) {
      router.push('/login');
    }
  }, [user, isInitialized, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Show loading while initializing or if no user
  if (!isInitialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Deployments', href: '/dashboard/deployments', icon: Rocket },
    { name: 'Credentials', href: '/dashboard/credentials', icon: Key },
    { name: 'Password Security', href: '/dashboard/security', icon: Shield },
    { name: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'API Keys', href: '/dashboard/api-keys', icon: Key },
    { name: 'API Docs', href: '/dashboard/api-docs', icon: FileText },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  // Add Admin links if user is super admin
  if (user.role === 'super_admin') {
    navigation.splice(7, 0, {
      name: 'Admin Panel',
      href: '/dashboard/admin',
      icon: Shield,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Rocket className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Focal Deploy</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {user.licenseTier.toUpperCase()}
              {user.role === 'super_admin' && ' • ADMIN'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Beta Notice Badge */}
        <div className="px-4 py-2">
          <button
            onClick={() => setShowBetaModal(true)}
            className="flex items-center w-full px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors group"
            title="Click for beta information"
          >
            <AlertCircle className="h-4 w-4 mr-2 group-hover:animate-pulse" />
            <span className="flex items-center">
              BETA
              <span className="ml-1 text-[10px] opacity-75">(Click for info)</span>
            </span>
          </button>
        </div>

        {/* Logout button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Beta Modal */}
      {showBetaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowBetaModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">Beta Software</h3>
                  <p className="text-sm text-orange-600 font-medium">Currently in Beta</p>
                </div>
              </div>
              <button
                onClick={() => setShowBetaModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong className="text-gray-900">Focal Deploy is currently in beta.</strong> While we strive to provide a reliable service, you may encounter:
              </p>

              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Occasional bugs or unexpected behavior</li>
                <li>Features that are still being refined</li>
                <li>Temporary service interruptions</li>
                <li>Changes to functionality without prior notice</li>
              </ul>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-4">
                <p className="text-sm text-blue-900">
                  <strong>Important:</strong> We recommend testing thoroughly before using in production environments. Regular backups of your data are strongly advised.
                </p>
              </div>

              <p className="mt-4">
                By using this beta service, you acknowledge that the software is provided "as is" and may not function perfectly. We appreciate your patience and feedback as we continue to improve!
              </p>

              <div className="bg-gray-50 p-3 rounded mt-4">
                <p className="text-xs text-gray-600">
                  <strong>Questions or found a bug?</strong> Contact support at{' '}
                  <a href="mailto:support@focuswithfocal.io" className="text-blue-600 hover:underline">
                    support@focuswithfocal.io
                  </a>
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowBetaModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center h-16 px-4 bg-white border-b border-gray-200 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          {/* Future: notifications, profile dropdown, etc. */}
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
