'use client';

import { useEffect, useState } from 'react';
import { formatINR } from '@reliefchain/shared-types';
import { getCachedData, isCacheFresh, setCachedData, invalidateCache, subscribeToCacheInvalidation } from '../../../../lib/api-cache';

export default function CampaignsApprovalPage() {
  const cachedCampaigns = getCachedData<any[]>('campaigns_list');
  const [campaigns, setCampaigns] = useState<any[]>(() => cachedCampaigns || []);
  const [loading, setLoading] = useState(() => !cachedCampaigns || cachedCampaigns.length === 0);

  const fetchCampaigns = () => {
    if (!cachedCampaigns || cachedCampaigns.length === 0) {
      setLoading(true);
    }
    fetch('/api/campaigns', { credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setCachedData('campaigns_list', data || []);
        setCampaigns(data || []);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isCacheFresh('campaigns_list', 3000)) {
      fetchCampaigns();
    }

    const unsubscribe = subscribeToCacheInvalidation(() => {
      fetchCampaigns();
    });
    const interval = setInterval(fetchCampaigns, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/approve`, { 
        method: 'PATCH',
        credentials: 'include'
      });
      if (res.ok) {
        invalidateCache();
        fetchCampaigns();
      } else {
        console.error('Failed to approve campaign');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-6 sm:space-y-8">
        <h2 className="text-2xl font-semibold text-forest">Campaigns Approval</h2>
        
        <div className="bg-white border border-forest/20 p-4 sm:p-6 shadow-sm rounded-2xl">
          <h3 className="text-lg font-medium text-forest mb-4">Pending Campaigns</h3>
          {loading ? (
            <div className="text-center p-4">Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center text-forest/70 py-8">No campaigns found.</div>
          ) : (
            <ul className="divide-y divide-[#064E3B]/10">
              {campaigns.map(c => (
                <li key={c.id} className="py-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-forest truncate">{c.name}</p>
                      <p className="text-sm text-forest/70">Status: {c.status} | Target: {formatINR(c.targetAmount)}</p>
                    </div>
                    {c.status === 'PENDING_AUTHORITY_APPROVAL' && (
                      <button 
                        onClick={() => handleApprove(c.id)}
                        className="px-4 py-2 bg-forest text-sand text-sm rounded-sm"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );
}
