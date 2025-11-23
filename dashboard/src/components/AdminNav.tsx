'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Settings, ScrollText, Lock, ChevronRight, Terminal, Mail } from 'lucide-react';

const adminNavItems = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: Shield },
  { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  { name: 'Security', href: '/dashboard/admin/security', icon: Lock },
  { name: 'Emails', href: '/dashboard/admin/emails', icon: Mail },
  { name: 'System Logs', href: '/dashboard/admin/logs', icon: Terminal },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-b border-gray-200 mb-6">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-gray-900">Admin Panel</span>
        </div>
      </div>
      <nav className="flex space-x-1 px-6 overflow-x-auto">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard/admin' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
