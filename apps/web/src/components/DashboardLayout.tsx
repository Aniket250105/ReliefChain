'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SafeUserDto } from '@reliefchain/shared-types';
import DashboardRoleHeader from './DashboardRoleHeader';
import RoleKPIs from './RoleKPIs';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

// Client-side module cache so subsequent tab navigations are instant without unmounting
let isHydratedGlobal = false;
let cachedGlobalUser: SafeUserDto | null = null;

export function clearCachedGlobalUser() {
  cachedGlobalUser = null;
  isHydratedGlobal = false;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(() => isHydratedGlobal);
  const [user, setUser] = useState<SafeUserDto | null>(() => {
    if (isHydratedGlobal && cachedGlobalUser) {
      return cachedGlobalUser;
    }
    return null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    isHydratedGlobal = true;
    setIsHydrated(true);

    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }

    const storedUserStr = localStorage.getItem('user');
    const isPublic = pathname.startsWith('/public') || pathname.startsWith('/verify');
    
    if (storedUserStr) {
      try {
        const parsed = JSON.parse(storedUserStr);
        cachedGlobalUser = parsed;
        setUser(parsed);
      } catch {}
    } else if (!isPublic) {
      router.push('/login');
    }
  }, [router, pathname]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    let lastWidth = window.innerWidth;
    const onResize = () => {
      const currentWidth = window.innerWidth;
      if ((lastWidth < 1024 && currentWidth >= 1024) || (lastWidth >= 1024 && currentWidth < 1024)) {
        handleResize();
      }
      lastWidth = currentWidth;
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Automatically close sidebar on mobile when navigating
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  const isPublic = pathname.startsWith('/public') || pathname.startsWith('/verify');

  // During SSR or initial client hydration render before mount
  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-sand items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-forest/70 tracking-widest uppercase">Loading ReliefChain...</p>
        </div>
      </div>
    );
  }

  // Once hydrated, if unauthenticated on protected routes
  if (!user && !isPublic) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-sand items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-forest/70 tracking-widest uppercase">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const isMainRoleDashboard = [
    '/dashboard/authority',
    '/dashboard/ngo',
    '/dashboard/donor',
    '/dashboard/supplier',
    '/dashboard/warehouse',
    '/dashboard/officer',
    '/dashboard/auditor',
  ].includes(pathname);

  const showRoleHeader = user && isMainRoleDashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-sand text-forest relative">
      {/* Mobile Backdrop Overlay */}
      {user && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-forest/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - only if logged in */}
      {user && (
        <Sidebar 
          user={user} 
          currentPath={pathname} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative">
        {user ? (
          <TopHeader 
            user={user} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
        ) : (
          <div className="bg-white border-b border-forest/10 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
            <a href="/" className="text-xl font-bold text-forest flex items-center gap-2">
              <img src="/logo.jpg" alt="ReliefChain Logo" className="w-8 h-8 rounded-lg shadow-sm" />
              ReliefChain Public
            </a>
            <div className="flex items-center gap-4">
              <a href="/login" className="text-sm font-medium text-forest hover:text-gold transition-colors">Staff Login</a>
            </div>
          </div>
        )}
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {showRoleHeader && (
              <>
                <DashboardRoleHeader user={user} />
                <RoleKPIs role={user.role} />
              </>
            )}
            <div className="animate-fade-in-quick w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
