'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRoleDashboardHref } from '../../lib/role-routes';

export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        router.replace(getRoleDashboardHref(user?.role));
      } else {
        router.replace('/login');
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-forest">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
