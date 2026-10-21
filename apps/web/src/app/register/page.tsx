'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const INDIAN_STATES_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const REGISTRABLE_ROLES = [
  { value: 'DONOR', label: 'Donor', desc: 'Contribute to relief campaigns', needsOrg: false },
  { value: 'NGO_ADMIN', label: 'NGO Administrator', desc: 'Manage your NGO (requires approval)', needsOrg: true },
  { value: 'SUPPLIER', label: 'Supplier / Vendor', desc: 'Supply relief materials (requires approval)', needsOrg: true },
  { value: 'WAREHOUSE_OPERATOR', label: 'Warehouse Operator', desc: 'Manage relief warehouse (requires approval)', needsOrg: true },
];

const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    phone: '', role: 'DONOR', organizationName: '',
    state: '', district: '', city: '', pinCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedRole = REGISTRABLE_ROLES.find(r => r.value === form.role);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validatePhone = (phone: string) => {
    if (!phone) return true; // optional
    return /^\+91[6-9]\d{9}$/.test(phone);
  };

  const validatePinCode = (pin: string) => {
    if (!pin) return true; // optional
    return /^\d{6}$/.test(pin) && pin[0] !== '0';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setSuccess(null);

    // Client-side validation
    let newErrors: Record<string, string> = {};
    if (form.fullName.trim().length < 2) newErrors.fullName = 'Full name must be at least 2 characters';
    if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (form.phone && !validatePhone(form.phone)) newErrors.phone = 'Phone must be a valid Indian mobile number (+91 followed by 10 digits)';
    if (form.pinCode && !validatePinCode(form.pinCode)) newErrors.pinCode = 'PIN code must be a valid 6-digit Indian PIN code';
    if (selectedRole?.needsOrg && !form.organizationName.trim()) newErrors.organizationName = 'Organization name is required for this role';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSuccess(data.message);
    } catch (err: any) {
      setErrors({ global: err.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, var(--color-forest) 0%, #0a2927 100%)' }}>
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-5/12 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
          <div className="relative z-10 text-left w-fit mx-auto">
            <Link href="/" className="inline-block px-6 py-4 border-2 border-sand mb-8 rounded-2xl transition hover:opacity-95" style={{ background: 'rgba(248, 231, 201, 0.15)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center gap-4">
                <img src="/logo.jpg" alt="ReliefChain Logo" className="w-12 h-12 rounded-xl shadow-sm" />
                <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#F8E7C9' }}>ReliefChain</h1>
              </div>
            </Link>
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">India&apos;s Blockchain-Powered</h2>
              <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">Disaster Relief Platform</h2>
            </div>
            <div className="space-y-3.5 text-left">
              {[
                'Transparent fund allocation & tracking',
                'Verified disaster response network',
                'Tamper-proof resource delivery',
                'Real-time cryptographic audit trail'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-sand flex-shrink-0" />
                  <span className="text-emerald-100 text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Success Message */}
        <div className="flex-1 flex flex-col justify-center items-center py-12 px-6 bg-sand lg:rounded-l-[2.5rem] shadow-2xl lg:shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-forest/10 p-8 sm:p-10 text-center">
            <div className="h-16 w-16 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-5 text-forest text-3xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-forest mb-2">Registration Successful</h2>
            <p className="text-sm text-forest/70 mb-8 leading-relaxed">{success}</p>
            <Link 
              href="/login" 
              className="inline-block w-full py-3.5 px-6 bg-forest text-sand font-semibold rounded-xl hover:opacity-95 transition text-sm shadow-sm"
            >
              Sign In to Your Account →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, var(--color-forest) 0%, #0a2927 100%)' }}>
      {/* Left Panel - Branding (Matching Login Page) */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10 text-left w-fit mx-auto">
          <Link href="/" className="inline-block px-6 py-4 border-2 border-sand mb-8 rounded-2xl transition hover:opacity-95" style={{ background: 'rgba(248, 231, 201, 0.15)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center gap-4">
              <img src="/logo.jpg" alt="ReliefChain Logo" className="w-12 h-12 rounded-xl shadow-sm" />
              <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#F8E7C9' }}>ReliefChain</h1>
            </div>
          </Link>
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">India&apos;s Blockchain-Powered</h2>
            <h2 className="text-xl sm:text-2xl font-medium text-emerald-100 leading-snug">Disaster Relief Platform</h2>
          </div>
          <div className="space-y-3.5 text-left">
            {[
              'Transparent fund allocation & tracking',
              'Verified disaster response network',
              'Tamper-proof resource delivery',
              'Real-time cryptographic audit trail'
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-sand flex-shrink-0" />
                <span className="text-emerald-100 text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-8 lg:px-14 bg-sand lg:rounded-l-[2.5rem] shadow-2xl lg:shadow-[-10px_0_30px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="max-w-xl w-full mx-auto my-auto py-2">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center items-center gap-3">
            <img src="/logo.jpg" alt="ReliefChain Logo" className="w-10 h-10 rounded-xl shadow-sm" />
            <h1 className="text-3xl font-bold text-forest border-b-2 border-forest pb-1 inline-block">ReliefChain</h1>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-forest/10 relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-forest mb-2 tracking-tight">Create Account</h2>
            <p className="text-sm text-forest/60 mb-6 sm:mb-8 font-medium">Join India&apos;s unified disaster relief and resource distribution network</p>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" id="register-form">
              {errors.global && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{errors.global}</span>
                </div>
              )}

              {/* Account Type */}
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">Account Type</label>
                <select
                  value={form.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  id="register-role"
                >
                  {REGISTRABLE_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
                {selectedRole && selectedRole.needsOrg && (
                  <p className="mt-1.5 text-xs text-amber-800 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>This operational role requires system administrator verification before activation.</span>
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="reg-name" className="block text-sm font-semibold text-forest mb-1.5">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                />
                {errors.fullName && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.fullName}</p>}
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="reg-email" className="block text-sm font-semibold text-forest mb-1.5">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                />
                {errors.email && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.email}</p>}
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-semibold text-forest mb-1.5">
                  Phone Number <span className="text-forest/40 font-normal">(optional)</span>
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                />
                {errors.phone && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.phone}</p>}
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-semibold text-forest mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm pr-14 focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 hover:text-forest text-xs font-semibold px-1 py-0.5 rounded cursor-pointer transition" 
                      tabIndex={-1}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.password}</p>}
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-semibold text-forest mb-1.5">Confirm Password</label>
                  <input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  />
                  {errors.confirmPassword && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.confirmPassword}</p>}
                </div>
              </div>

              {/* Organization Name (conditional) */}
              {selectedRole?.needsOrg && (
                <div>
                  <label htmlFor="reg-org" className="block text-sm font-semibold text-forest mb-1.5">Organization Name</label>
                  <input
                    id="reg-org"
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={(e) => handleChange('organizationName', e.target.value)}
                    placeholder="e.g., Hope Relief Foundation India"
                    className="w-full px-4 py-3 border border-forest/20 rounded-xl bg-sand/30 text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  />
                  {errors.organizationName && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.organizationName}</p>}
                </div>
              )}

              {/* Location in India */}
              <fieldset className="border border-forest/15 rounded-2xl p-4 sm:p-5 bg-sand/20 space-y-3">
                <legend className="text-xs font-bold text-forest uppercase tracking-wider px-2">
                  Location in India <span className="text-forest/40 lowercase font-normal">(optional)</span>
                </legend>
                <div>
                  <select
                    value={form.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="w-full px-4 py-2.5 border border-forest/20 rounded-xl bg-white text-forest text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                    id="reg-state"
                  >
                    <option value="">Select State / Union Territory</option>
                    {INDIAN_STATES_UTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={form.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    placeholder="District"
                    className="px-4 py-2.5 border border-forest/20 rounded-xl bg-white text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  />
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="City / Place"
                    className="px-4 py-2.5 border border-forest/20 rounded-xl bg-white text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  />
                </div>
                <input
                  type="text"
                  value={form.pinCode}
                  onChange={(e) => handleChange('pinCode', e.target.value)}
                  placeholder="6-digit PIN Code"
                  maxLength={6}
                  className="w-full px-4 py-2.5 border border-forest/20 rounded-xl bg-white text-forest placeholder-forest/40 text-sm focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition"
                  id="reg-pincode"
                />
                {errors.pinCode && <p className="text-red-600 text-xs mt-1.5 font-medium">{errors.pinCode}</p>}
              </fieldset>

              <button
                type="submit"
                disabled={loading}
                id="register-submit"
                className="w-full py-3.5 px-4 bg-forest text-sand font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm shadow-sm cursor-pointer mt-2"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-forest/70">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-forest hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
