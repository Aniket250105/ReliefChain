'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@/lib/WalletContext';

export default function WalletConnectButton({ 
  className = '',
  preferredRole
}: { 
  className?: string;
  preferredRole?: string;
}) {
  const {
    isConnected,
    address,
    chainId,
    walletType,
    walletName,
    isMetaMaskAvailable,
    availableDevAccounts,
    connectWallet,
    connectMetaMask,
    connectDevWallet,
    disconnectWallet
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickConnect = () => {
    if (preferredRole) {
      connectDevWallet(preferredRole);
    } else {
      connectWallet();
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {!isConnected ? (
        <div className="inline-flex rounded-xl shadow-sm">
          <button
            type="button"
            onClick={handleQuickConnect}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold rounded-l-xl text-white bg-forest hover:bg-forest/90 transition-all border-r border-white/20 active:scale-[0.98] whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
            Connect Wallet
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-2 sm:px-2.5 py-2 text-xs font-medium rounded-r-xl text-white bg-forest hover:bg-forest/90 transition-all focus:outline-none"
            title="Choose Wallet Type"
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Network Badge */}
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200/80 shadow-xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hardhat {chainId}
          </span>

          {/* Account Chip / Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-xl text-forest bg-white hover:bg-sand/40 border border-forest/15 shadow-sm transition-all max-w-[160px] sm:max-w-none"
          >
            <span className="text-sm shrink-0">
              {walletType === 'metamask' ? '🦊' : '⚡'}
            </span>
            <span className="font-semibold text-forest truncate">
              {walletName || (walletType === 'dev' ? 'Dev Wallet' : 'MetaMask')}
            </span>
            <span className="font-mono text-forest/70 text-[11px] bg-sand/60 px-1.5 py-0.5 rounded hidden lg:inline shrink-0">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <svg className={`w-3 h-3 text-forest/50 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Wallet Selector Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-2xl bg-white shadow-xl ring-1 ring-black/10 z-50 p-2 divide-y divide-forest/10 animate-in fade-in duration-150">
          {/* Header */}
          <div className="p-2 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-forest uppercase tracking-wider">
                {isConnected ? 'Connected Wallet' : 'Select Wallet Connection'}
              </span>
              {isConnected && (
                <button
                  onClick={() => {
                    disconnectWallet();
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-semibold text-terracotta hover:text-red-700 hover:underline"
                >
                  Disconnect
                </button>
              )}
            </div>
            {isConnected && (
              <div className="mt-2 text-[11px] font-mono text-forest/70 bg-sand/40 p-2 rounded-lg break-all select-all border border-forest/10">
                {address}
              </div>
            )}
          </div>

          {/* Wallet Options */}
          <div className="py-2 space-y-1">
            {/* MetaMask Option */}
            <button
              onClick={() => {
                connectMetaMask();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-sand/40 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🦊</span>
                <div>
                  <div className="text-xs font-bold text-forest">MetaMask</div>
                  <div className="text-[10px] text-forest/60">
                    {isMetaMaskAvailable ? 'Browser extension detected' : 'Not detected in browser'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isMetaMaskAvailable 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-sand text-forest/60'
              }`}>
                {isMetaMaskAvailable ? 'Available' : 'Use Dev Wallet'}
              </span>
            </button>

            {/* Dev Wallets Section */}
            <div className="pt-2 px-1">
              <div className="text-[10px] font-bold text-forest/50 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Built-in Dev Accounts (Chain 31337)</span>
                <span className="text-emerald-700 font-medium">Pre-Funded</span>
              </div>

              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {availableDevAccounts.map((acc) => {
                  const isCurrent = address?.toLowerCase() === acc.address.toLowerCase();
                  return (
                    <button
                      key={acc.address}
                      onClick={() => {
                        connectDevWallet(acc.address);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center justify-between ${
                        isCurrent 
                          ? 'bg-forest/10 border border-forest/20' 
                          : 'hover:bg-sand/40 border border-transparent'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="text-xs font-semibold text-forest flex items-center gap-1.5">
                          <span>⚡</span>
                          <span className="truncate">{acc.name}</span>
                          {isCurrent && <span className="text-emerald-700 text-[10px]">✓</span>}
                        </div>
                        <div className="text-[10px] font-mono text-forest/60">
                          {acc.address.slice(0, 8)}...{acc.address.slice(-6)}
                        </div>
                      </div>
                      <span className="text-[9px] font-medium text-forest/50 bg-white px-1.5 py-0.5 rounded border border-forest/10 whitespace-nowrap">
                        {acc.role.replace(/_/g, ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
