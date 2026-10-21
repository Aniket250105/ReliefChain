'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email.trim()) { setError('Email is required'); setLoading(false); return; }

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Request failed');
      }

      setSuccess(true);

      // In dev mode, the API returns the reset token for testability
      if (data.resetToken) {
        setDevResetUrl(`/reset-password?token=${data.resetToken}`);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-3 mb-4">
            <img src="/logo.jpg" alt="ReliefChain Logo" className="w-10 h-10 rounded-xl shadow-sm" />
            <span className="text-2xl font-bold text-forest border-b-2 border-forest pb-1">ReliefChain</span>
          </Link>
          <h2 className="text-xl font-bold text-forest">Reset Password</h2>
          <p className="text-sm text-forest/60 mt-1">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 bg-sand rounded-full flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm text-forest/70">If an account with that email exists, a password reset link has been sent.</p>

              {devResetUrl && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs font-bold text-amber-800 mb-1">🔧 Dev Mode — Reset Link:</p>
                  <Link href={devResetUrl} className="text-xs text-forest hover:underline break-all font-mono">
                    {typeof window !== 'undefined' ? window.location.origin : ''}{devResetUrl}
                  </Link>
                </div>
              )}

              <Link href="/login" className="inline-block mt-4 px-6 py-2.5 bg-forest text-sand font-semibold rounded-md hover:opacity-90 transition text-sm">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" id="forgot-password-form">
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
              )}

              <div>
                <label htmlFor="fp-email" className="block text-sm font-semibold text-forest mb-1.5">Email Address</label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your account email"
                  className="w-full px-4 py-2.5 border border-forest/30 rounded-md bg-white text-forest placeholder-[#064E3B]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
                  style={{ marginBottom: 0 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                id="forgot-submit"
                className="w-full py-2.5 px-4 bg-forest text-sand font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-sm text-forest/60">
                Remember your password?{' '}
                <Link href="/login" className="font-semibold text-forest hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
