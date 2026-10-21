'use client';

import { useRouter } from 'next/navigation';
import { SafeUserDto } from '@reliefchain/shared-types';
import WalletConnectButton from './WalletConnectButton';

import Link from 'next/link';
import { clearCachedGlobalUser } from './DashboardLayout';
import { invalidateCache } from '../lib/api-cache';

export default function TopHeader({ 
  user,
  toggleSidebar
}: { 
  user: SafeUserDto,
  toggleSidebar?: () => void
}) {
  const router = useRouter();

  const handleLogout = () => {
    clearCachedGlobalUser();
    invalidateCache();
    localStorage.removeItem('user');
    router.push('/login');
  };

  // User doesn't have a name property, use email prefix instead
  const displayName = user.email ? user.email.split('@')[0] : 'User';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-sand border-b border-forest/10 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-4">
        {toggleSidebar && (
          <button 
            onClick={toggleSidebar}
            className="text-forest hover:text-gold transition-colors flex items-center justify-center p-2 rounded-lg hover:bg-forest/5"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        )}
        
        <button 
          onClick={() => router.back()}
          className="text-xs font-semibold text-forest/70 hover:text-forest transition-colors flex items-center gap-1 border border-forest/20 bg-white px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0">
        <WalletConnectButton preferredRole={user.role} />
        
        <Link 
          href="/notifications"
          prefetch={true}
          className="text-forest hover:text-gold transition-colors relative group p-1.5 inline-flex items-center justify-center"
          title="Notifications"
          aria-label="Notifications"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-terracotta rounded-full border-2 border-sand"></span>
        </Link>
        
        <Link 
          href="/dashboard/profile"
          prefetch={true}
          className="flex items-center gap-2 sm:gap-3 hover:opacity-85 transition-opacity cursor-pointer group"
          title="View Profile"
        >
          <div className="flex-col items-end hidden md:flex min-w-0">
            <span className="text-sm font-semibold text-forest group-hover:text-gold transition-colors truncate max-w-[120px]">{displayName}</span>
            <span className="text-xs text-forest/70 truncate max-w-[120px]">{user.email}</span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-forest text-sand flex items-center justify-center font-bold text-sm shadow-sm shrink-0 border border-transparent group-hover:border-gold transition-colors" title={user.email}>
            {initials}
          </div>
        </Link>

        <button 
          onClick={handleLogout}
          className="text-xs sm:text-sm text-forest/70 hover:text-terracotta transition-colors font-medium px-2 py-1 rounded hover:bg-forest/5"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
