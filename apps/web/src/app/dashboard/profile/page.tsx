'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache } from '../../../lib/api-cache';

const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export default function ProfilePage() {
  const router = useRouter();
  const cachedProfile = getCachedData<any>('user_profile');

  const [profile, setProfile] = useState<any>(() => cachedProfile || null);
  const [loading, setLoading] = useState<boolean>(() => !cachedProfile);
  
  // Password change state
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (!profile) {
      try {
        const s = localStorage.getItem('user');
        if (s) {
          const parsed = JSON.parse(s);
          setProfile(parsed);
          setLoading(false);
        }
      } catch {}
    }
    if (!isCacheFresh('user_profile', 30000)) {
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 && !localStorage.getItem('user')) {
          router.push('/login');
          return;
        }
        return;
      }
      const data = await res.json();
      setCachedData('user_profile', data);
      setProfile(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdError(null);
    setPwdSuccess(null);

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('New passwords do not match');
      setPwdLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwdForm)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setPwdSuccess('Password changed successfully');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading && !profile) return <div className="p-6 text-center text-forest/60">Loading profile...</div>;
  if (!profile) return <div className="p-6 text-center text-forest/60">Unable to load profile.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-forest">My Profile</h2>
      
      <div className="bg-white border border-forest/20 p-5 sm:p-8 shadow-sm space-y-6 sm:space-y-8 rounded-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 border-b border-forest/20 pb-6 sm:pb-8">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-forest flex items-center justify-center text-sand text-3xl sm:text-4xl font-semibold shadow-inner shrink-0">
            {profile.fullName?.charAt(0) || profile.email?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="text-2xl sm:text-3xl font-bold text-forest truncate">
              {profile.fullName || 'User'}
            </h3>
            <p className="text-forest/70 mt-1 text-sm sm:text-base break-all">{profile.email}</p>
            {profile.status && (
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-full ${
                profile.status === 'ACTIVE' ? 'bg-sand text-forest' :
                profile.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }`}>
                {profile.status}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-forest/50 uppercase tracking-wider mb-1">Role</label>
            <p className="text-forest font-medium p-3 bg-gray-50 border border-gray-100 rounded-md">
              {profile.role.replace('_', ' ')}
            </p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-forest/50 uppercase tracking-wider mb-1">Organization</label>
            <p className="text-forest font-medium p-3 bg-gray-50 border border-gray-100 rounded-md">
              {profile.organization?.name || 'None'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-forest/50 uppercase tracking-wider mb-1">Phone</label>
            <p className="text-forest font-medium p-3 bg-gray-50 border border-gray-100 rounded-md">
              {profile.phone || 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-forest/50 uppercase tracking-wider mb-1">Location</label>
            <p className="text-forest font-medium p-3 bg-gray-50 border border-gray-100 rounded-md">
              {[profile.city, profile.district, profile.state, profile.pinCode].filter(Boolean).join(', ') || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white border border-forest/20 p-8 shadow-sm rounded-lg">
        <h3 className="text-lg font-bold text-forest border-b border-forest/10 pb-3 mb-6">Security Settings</h3>
        
        <form onSubmit={handlePasswordChange} className="max-w-md space-y-4" id="change-password-form">
          {pwdError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{pwdError}</div>}
          {pwdSuccess && <div className="bg-white border border-forest/30 text-emerald-700 p-3 rounded-md text-sm">{pwdSuccess}</div>}
          
          <div>
            <label className="block text-sm font-semibold text-forest mb-1.5">Current Password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              className="w-full px-4 py-2 border border-forest/30 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-forest mb-1.5">New Password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              className="w-full px-4 py-2 border border-forest/30 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-forest mb-1.5">Confirm New Password</label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 border border-forest/30 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-forest/70">
              <input type="checkbox" checked={showPwd} onChange={(e) => setShowPwd(e.target.checked)} className="rounded text-forest focus:ring-[#064E3B]" />
              Show Passwords
            </label>
            
            <button
              type="submit"
              disabled={pwdLoading}
              className="px-6 py-2 bg-forest text-sand font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition text-sm"
            >
              {pwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
