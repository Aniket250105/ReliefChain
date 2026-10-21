'use client';

import Link from 'next/link';
import { getRoleDashboardHref } from '../lib/role-routes';

export default function Sidebar({ 
  user, 
  currentPath, 
  isOpen = true, 
  setIsOpen 
}: { 
  user: any, 
  currentPath: string,
  isOpen?: boolean,
  setIsOpen?: (val: boolean) => void
}) {
  const getLinks = () => {
    const dashboardHref = getRoleDashboardHref(user?.role);
    
    const base = [
      { name: 'Dashboard', href: dashboardHref }
    ];

    if (user?.role === 'GOVERNMENT_AUTHORITY') {
      base.push({ name: 'Campaigns', href: '/dashboard/authority/campaigns' });
      base.push({ name: 'Allocations', href: '/dashboard/authority/allocations' });
    } else if (user?.role === 'NGO_ADMIN' || user?.role === 'NGO_OPERATOR') {
      base.push({ name: 'Allocations', href: '/dashboard/ngo/allocations' });
    } else if (user?.role === 'AUDITOR' || user?.role === 'SYSTEM_ADMIN') {
      base.push({ name: 'AI Monitoring', href: '/ai-alerts' });
    }

    base.push({ name: 'Public Data', href: '/public/dashboard' });
    base.push({ name: 'Notifications', href: '/notifications' });
    base.push({ name: 'QR Verification', href: '/verify' });
    base.push({ name: 'Profile', href: '/dashboard/profile' });
    
    return base;
  };

  const links = getLinks();

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && setIsOpen) {
      setIsOpen(false);
    }
  };

  return (
    <aside 
      className={`bg-forest text-sand flex flex-col duration-300 ease-in-out transition-all
        fixed inset-y-0 left-0 z-50 shadow-2xl lg:shadow-none
        lg:static lg:inset-auto lg:shrink-0
        ${isOpen 
          ? 'translate-x-0 w-64 opacity-100 pointer-events-auto' 
          : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden pointer-events-none'
        }
      `}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 w-64 shrink-0">
        <Link 
          href={getRoleDashboardHref(user?.role)} 
          onClick={handleLinkClick}
          className="text-xl font-bold flex items-center gap-3 whitespace-nowrap"
        >
          <img src="/logo.jpg" alt="ReliefChain Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          ReliefChain
        </Link>
        {/* Mobile close button */}
        {setIsOpen && (
          <button 
            type="button"
            onClick={() => setIsOpen(false)} 
            className="lg:hidden p-1.5 rounded-lg text-sand/70 hover:text-sand hover:bg-white/10 transition-colors"
            title="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto w-64">
        {links.map((link) => {
          const isActive = link.name === 'Dashboard' 
            ? currentPath === link.href 
            : currentPath.startsWith(link.href);
            
          return (
            <Link 
              key={link.name} 
              href={link.href}
              prefetch={true}
              onClick={handleLinkClick}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-white/10 text-gold font-semibold' 
                  : 'text-sand/80 hover:bg-white/5 hover:text-sand'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-white/10 text-xs text-sand/60 w-64 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-4 h-4 rounded-full bg-gold"></span>
          India Only
        </div>
        All operations are restricted to India only.
      </div>
    </aside>
  );
}
