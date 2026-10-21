'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);

    if (form.newPassword.length < 8) { setError('Password must be at least 8 characters'); setLoading(false); return; }
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: form.newPassword, confirmPassword: form.confirmPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
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
          <h2 className="text-xl font-bold text-forest">Set New Password</h2>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 bg-sand rounded-full flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-forest font-medium">Password has been reset successfully.</p>
              <Link href="/login" className="inline-block mt-4 px-6 py-2.5 bg-forest text-sand font-semibold rounded-md hover:opacity-90 transition text-sm">
                Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" id="reset-password-form">
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
              )}

              <div>
                <label htmlFor="reset-new" className="block text-sm font-semibold text-forest mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    id="reset-new"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={!token}
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-2.5 border border-forest/30 rounded-md bg-white text-forest text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50 disabled:opacity-50"
                    style={{ marginBottom: 0 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 text-xs">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-semibold text-forest mb-1.5">Confirm Password</label>
                <input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={!token}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 border border-forest/30 rounded-md bg-white text-forest text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50 disabled:opacity-50"
                  style={{ marginBottom: 0 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                id="reset-submit"
                className="w-full py-2.5 px-4 bg-forest text-sand font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sand flex items-center justify-center p-4"><p>Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
