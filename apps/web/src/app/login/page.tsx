'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/api-client';
import { invalidateCache } from '../../lib/api-cache';
import Link from 'next/link';

const DEMO_ACCOUNTS = [
  { role: 'SYSTEM_ADMIN', label: 'System Admin', email: 'sysadmin@reliefchain.local', desc: 'System administration.' },
  { role: 'GOVERNMENT_AUTHORITY', label: 'Government Authority', email: 'authority@gov.local', desc: 'Verifies disasters, approves campaigns, and oversees allocation authorization.' },
  { role: 'NGO_ADMIN', label: 'NGO Admin', email: 'ngoadmin@hoperelief.local', desc: 'Manages campaigns and proposes relief allocations.' },
  { role: 'NGO_OPERATOR', label: 'NGO Operator', email: 'ngooperator@hoperelief.local', desc: 'Performs NGO operational tasks.' },
  { role: 'SUPPLIER', label: 'Supplier / Vendor', email: 'supplier@medlogistics.local', desc: 'Registers relief resources and provenance.' },
  { role: 'WAREHOUSE_OPERATOR', label: 'Warehouse Operator', email: 'warehouse@central.local', desc: 'Receives resources and manages inventory.' },
  { role: 'RELIEF_OFFICER', label: 'Relief Officer', email: 'reliefofficer@hoperelief.local', desc: 'Distributes resources and records evidence.' },
  { role: 'AUDITOR', label: 'Auditor', email: 'auditor@trustaudit.local', desc: 'Reviews audit information and AI alerts.' },
  { role: 'DONOR', label: 'Donor', email: 'donor@example.local', desc: 'Supports campaigns and views impact.' },
];

const DEMO_PASSWORD = 'devpassword123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDemoSelect = (account: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    let newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const authData = await login(email.trim(), password);
      invalidateCache();
      localStorage.setItem('user', JSON.stringify(authData.user));

      switch (authData.user.role) {
        case 'GOVERNMENT_AUTHORITY':
        case 'SYSTEM_ADMIN':
          router.push('/dashboard/authority');
          break;
        case 'NGO_ADMIN':
        case 'NGO_OPERATOR':
          router.push('/dashboard/ngo');
          break;
        case 'DONOR':
          router.push('/dashboard/donor');
          break;
        case 'SUPPLIER':
          router.push('/dashboard/supplier');
          break;
        case 'WAREHOUSE_OPERATOR':
          router.push('/dashboard/warehouse');
          break;
        case 'RELIEF_OFFICER':
          router.push('/dashboard/officer');
          break;
        case 'AUDITOR':
          router.push('/dashboard/auditor');
          break;
        default:
          router.push('/public/dashboard');
      }
    } catch (err: any) {
      setErrors({ global: err.message || 'Login failed. Please check your credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, var(--color-forest) 0%, #0a2927 100%)' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10 text-left w-fit mx-auto">
          <div className="inline-block px-6 py-4 border-2 border-sand mb-8 rounded-2xl" style={{ background: 'rgba(248, 231, 201, 0.15)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center gap-4">
              <img src="/logo.jpg" alt="ReliefChain Logo" className="w-12 h-12 rounded-xl shadow-sm" />
              <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#F8E7C9' }}>ReliefChain</h1>
            </div>
          </div>
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">India's Blockchain-Powered</h2>
            <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">Disaster Relief Platform</h2>
          </div>
          <div className="space-y-3 text-left">
            {['Transparent fund allocation', 'On-chain supply tracking', 'Real-time impact verification'].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-sand flex-shrink-0" />
                <span className="text-emerald-100 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center py-8 px-4 sm:px-8 lg:px-16 bg-sand lg:rounded-l-[2.5rem] shadow-2xl lg:shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center items-center gap-3">
            <img src="/logo.jpg" alt="ReliefChain Logo" className="w-10 h-10 rounded-xl shadow-sm" />
            <h1 className="text-3xl font-bold text-forest border-b-2 border-forest pb-1 inline-block">ReliefChain</h1>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-forest/10 relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-forest mb-2 tracking-tight">Sign In</h2>
            <p className="text-sm text-forest/60 mb-6 sm:mb-8 font-medium">Enter your credentials to access your dashboard</p>

          <form className="space-y-5" onSubmit={handleSubmit} id="login-form">
            {errors.global && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <span>{errors.global}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-forest mb-1.5">Email Address</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest text-sm transition"
                style={{ marginBottom: 0 }}
              />
              {errors.email && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-semibold text-forest">Password</label>
                <Link href="/forgot-password" className="text-xs text-forest/70 hover:text-forest hover:underline transition">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest text-sm pr-12 transition"
                  style={{ marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest transition text-xs font-medium"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              id="login-submit"
              className="w-full py-3 px-4 bg-forest text-sand font-semibold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-forest/60">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-forest hover:underline">Create account</Link>
          </p>

          </div>

          {/* Demo Account Selector */}
          <div className="mt-8 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-2.5 py-1 bg-gold/20 text-yellow-800 text-[10px] font-bold rounded-full uppercase tracking-wider border border-gold/30">Dev Only</span>
              <span className="text-xs font-semibold text-forest/60 uppercase tracking-wider">Demo Accounts</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2" id="demo-accounts">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleDemoSelect(account)}
                  data-role={account.role}
                  data-email={account.email}
                  className={`px-3 py-2 text-[10px] font-semibold rounded-xl border transition-all text-center leading-tight ${
                    email === account.email
                      ? 'bg-forest text-sand border-forest shadow-md'
                      : 'bg-white text-forest border-forest/10 hover:border-forest/30 hover:bg-forest/5 shadow-sm'
                  }`}
                >
                  {account.label}
                </button>
              ))}
            </div>
            {email && DEMO_ACCOUNTS.find(a => a.email === email) && (
              <div className="mt-4 p-3 bg-white border border-forest/10 rounded-xl text-xs text-forest shadow-sm">
                <span className="font-bold">{DEMO_ACCOUNTS.find(a => a.email === email)?.label}:</span> {DEMO_ACCOUNTS.find(a => a.email === email)?.desc}
              </div>
            )}
            <p className="mt-4 text-[10px] text-forest/40 text-center font-medium">
              Password: <code className="bg-white/60 px-1.5 py-0.5 rounded border border-forest/10">devpassword123</code> for all demo accounts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
