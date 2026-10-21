'use client';
import { useEffect, useState } from 'react';
import { formatINR, INDIA_CURRENCY_SYMBOL } from '@reliefchain/shared-types';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import toast from 'react-hot-toast';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '../../../lib/api-cache';

export default function NgoDashboard() {
  const cachedCampaigns = getCachedData<any[]>('ngo_campaigns');
  const cachedDisasters = getCachedData<any[]>('active_disasters');
  const [campaigns, setCampaigns] = useState<any[]>(() => cachedCampaigns || []);
  const [loading, setLoading] = useState(() => !cachedCampaigns || cachedCampaigns.length === 0);
  const [disasters, setDisasters] = useState<any[]>(() => cachedDisasters || []);
  const [newCampaign, setNewCampaign] = useState({ name: '', targetAmount: 10000, disasterId: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
      if (res.status === 401) throw new Error('Authentication required.');
      if (res.status === 403) throw new Error('Access denied.');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setCachedData('ngo_campaigns', data);
      setCampaigns(data);
    } catch (e: any) {
      if (!cachedCampaigns) toast.error(e.message || 'Unable to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchDisasters = async () => {
    try {
      const res = await fetch('/api/disasters', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((d: any) => 
          d.status === 'ACTIVE' || d.status === 'Active' || d.status === 'VERIFIED' || d.status === 'Verified'
        );
        setCachedData('active_disasters', active);
        setDisasters(active);
      }
    } catch {}
  };

  useEffect(() => {
    if (!isCacheFresh('ngo_campaigns', 3000)) fetchCampaigns();
    if (!isCacheFresh('active_disasters', 3000)) fetchDisasters();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchCampaigns();
      fetchDisasters();
    });
    const interval = setInterval(() => {
      fetchCampaigns();
      fetchDisasters();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCampaign)
      });
      if (res.status === 401) throw new Error('Authentication required.');
      if (res.status === 403) throw new Error('Not authorized. Only NGO Admin can create campaigns.');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Error (${res.status})`);
      }
      
      setNewCampaign({ name: '', targetAmount: 10000, disasterId: '' });
      invalidateCache();
      await fetchCampaigns();
      toast.success('Campaign requested successfully');
    } catch (e: any) {
      toast.error(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* LEFT COLUMN - Campaigns Table */}
      <div className="lg:col-span-2 space-y-6">
        <Card noPadding>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-forest/10 flex justify-between items-center bg-white/50 rounded-t-2xl">
            <h3 className="text-base sm:text-lg font-bold text-forest">My Active Campaigns</h3>
            <span className="text-xs sm:text-sm font-medium text-forest/60">View All</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Campaign</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Raised / Target</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Dispatched</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 font-semibold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-forest/50">Loading campaigns...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-forest/50">No campaigns found.</td></tr>
                ) : (
                  campaigns.map(c => {
                    const fundsRaised = Number(c.fundsRaised ?? c.raisedAmount ?? 0);
                    const target = Number(c.targetAmount ?? 10000);
                    const percent = target > 0 ? Math.min(100, Math.round((fundsRaised / target) * 100)) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-sand/30 transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <p className="font-medium text-forest">{c.name}</p>
                          <p className="text-xs text-forest/60 mt-1">{c.disaster?.name || 'Unknown Disaster'}</p>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <p className="text-forest font-medium">{formatINR(fundsRaised)} <span className="text-forest/50 text-xs font-normal">/ {formatINR(target)}</span></p>
                          <div className="w-24 h-1.5 bg-sand rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 font-medium text-forest/70 whitespace-nowrap">
                          {c.resourcesDistributed || 0} Units
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                          <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'}>
                            {c.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                          <Button variant="outline" className="px-3 py-1 text-xs bg-white">Manage</Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN - Form */}
      <div>
        <Card className="sticky top-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-forest/10 flex items-center justify-center text-forest">📢</div>
            <h3 className="text-lg font-bold text-forest">Start New Campaign</h3>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Campaign Name *</label>
              <input 
                type="text" 
                required
                value={newCampaign.name}
                onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
                placeholder="e.g. Medical Supplies Fund"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Linked Disaster *</label>
              <select
                required
                value={newCampaign.disasterId}
                onChange={e => setNewCampaign({...newCampaign, disasterId: e.target.value})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              >
                <option value="">Select a disaster...</option>
                {disasters.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.city ? `${d.city}, ` : ''}{d.state})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">Target Amount ({INDIA_CURRENCY_SYMBOL}) *</label>
              <input 
                type="number" 
                required
                min="1"
                value={newCampaign.targetAmount}
                onChange={e => setNewCampaign({...newCampaign, targetAmount: Number(e.target.value)})}
                className="w-full bg-sand/30 border border-forest/20 rounded-xl px-4 py-2.5 text-forest focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              />
            </div>
            
            <Button type="submit" variant="primary" fullWidth className="mt-4 py-3 text-base shadow-sm" disabled={submitting}>
              Submit Request
            </Button>
            <p className="text-xs text-center text-forest/50 mt-4">
              All campaigns require Authority approval before going live on the public dashboard.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
