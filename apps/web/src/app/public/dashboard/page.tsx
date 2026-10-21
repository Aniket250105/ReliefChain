'use client';

import { useEffect, useState } from 'react';
import { formatINR } from '@reliefchain/shared-types';
import dynamic from 'next/dynamic';
const IndiaMap = dynamic(() => import('../../../components/IndiaMap'), { ssr: false, loading: () => <div className="w-full h-full min-h-[500px] flex items-center justify-center text-forest/50">Loading Map...</div> });
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { getCachedData, isCacheFresh, setCachedData, subscribeToCacheInvalidation } from '../../../lib/api-cache';

export default function PublicDashboard() {
  const cachedData = getCachedData<any>('public_dashboard_data');
  const [data, setData] = useState<any>(() => cachedData || null);
  const [loading, setLoading] = useState(() => !cachedData);
  const [error, setError] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadData = () => {
    fetch('/api/public/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then(d => {
        setCachedData('public_dashboard_data', d);
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        if (!cachedData) setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      loadData();
    });
    const interval = setInterval(loadData, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (loading && !data) return <div className="min-h-screen bg-sand flex items-center justify-center text-forest">Loading public transparency dashboard...</div>;
  if (error && !data) return <div className="min-h-screen bg-sand flex items-center justify-center text-red-600">Service temporarily unavailable. Please try again later.</div>;
  if (!data) return <div className="min-h-screen bg-sand flex items-center justify-center text-forest">No data available.</div>;

  return (
    <div className="min-h-screen bg-sand">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Transparency KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 stagger-children-fade-up">
          <div className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden bg-forest border-forest transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 text-sand/70">Active Disasters</p>
              <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">⚠️</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-bold text-sand tracking-tight truncate">{data.activeDisasters ?? 0}</p>
              <p className="text-[11px] sm:text-xs mt-1 font-medium truncate text-sand/70">Ongoing relief</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden bg-gold border-gold transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 text-forest/70">Active Campaigns</p>
              <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">📢</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-bold text-forest tracking-tight truncate">{data.activeCampaigns ?? 0}</p>
              <p className="text-[11px] sm:text-xs mt-1 font-medium truncate text-forest/70">Accepting donations</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden bg-terracotta border-terracotta transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 text-white/80">Total Funds Raised</p>
              <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">₹</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-bold text-white tracking-tight truncate">{formatINR(data.totalFundsRaised || 0)}</p>
              <p className="text-[11px] sm:text-xs mt-1 font-medium truncate text-white/80">Public contributions</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden bg-white border-forest/10 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 text-forest/60">Resources Dist.</p>
              <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">📦</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-bold text-forest tracking-tight truncate">{(data.totalResourcesDistributed || 0).toLocaleString('en-IN')}</p>
              <p className="text-[11px] sm:text-xs mt-1 font-medium truncate text-forest/60">Units delivered</p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden bg-white border-forest/10 shadow-sm transition-transform hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 text-forest/60">Beneficiaries</p>
              <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">👥</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl xl:text-3xl font-bold text-forest tracking-tight truncate">{(data.totalBeneficiariesServed || 0).toLocaleString('en-IN')}</p>
              <p className="text-[11px] sm:text-xs mt-1 font-medium truncate text-forest/60">People assisted</p>
            </div>
          </div>
        </div>

        {/* Main Content: Map & Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map Section */}
          <div className="lg:col-span-2 flex flex-col space-y-6">
            <Card noPadding className="flex-1 flex flex-col min-h-[500px]">
              <div className="px-6 py-4 border-b border-forest/10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-forest">India Disaster Map</h3>
                <div className="flex gap-2">
                  <Badge variant="neutral">All Disasters</Badge>
                  <Badge variant="success">Active Only</Badge>
                </div>
              </div>
              <div className="flex-1 relative bg-sand/20 rounded-b-2xl">
                <IndiaMap disasters={data.disasters || []} />
                
                {/* Map Legend */}
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-4 rounded-xl shadow-sm border border-forest/10 text-xs font-medium space-y-2">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-terracotta"></span> Critical</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-terracotta/70"></span> High</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gold"></span> Medium</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-forest"></span> Low</div>
                </div>
              </div>
            </Card>

            {/* How Your Help Flows */}
            <Card>
              <h3 className="text-base font-bold text-forest mb-4">How Your Help Flows</h3>
              <div className="overflow-x-auto pb-2 -mx-2 px-2">
                <div className="min-w-[540px] flex justify-between items-center text-center">
                  <FlowStep icon="💰" label="Donations" sub="(UPI / Card)" />
                  <FlowArrow />
                  <FlowStep icon="📢" label="Campaigns" sub="(Verified)" />
                  <FlowArrow />
                  <FlowStep icon="📦" label="Resources" sub="(Tracked)" />
                  <FlowArrow />
                  <FlowStep icon="🚚" label="Distribution" sub="(Evidence)" />
                  <FlowArrow />
                  <FlowStep icon="✨" label="Impact" sub="(Real People)" />
                </div>
              </div>
            </Card>
          </div>

          {/* Active Campaigns Section */}
          <Card noPadding className="flex flex-col max-h-[800px]">
            <div className="px-6 py-4 border-b border-forest/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-forest">Active Campaigns</h3>
              <span className="text-xs font-medium text-forest/60 cursor-pointer">View All</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {data.campaigns.length === 0 ? (
                <div className="p-8 text-center text-forest/60">No active campaigns.</div>
              ) : (
                data.campaigns.map((c: any) => {
                  const fundsRaised = Number(c.fundsRaised ?? c.raisedAmount ?? 0);
                  const target = Number(c.targetAmount || 100000);
                  const percent = target > 0 ? Math.min(100, Math.round((fundsRaised / target) * 100)) : 0;
                  return (
                    <div key={c.campaignId} className="border border-forest/10 rounded-xl p-4 hover:border-forest/30 transition-colors bg-white">
                      <div className="mb-3">
                        <h4 className="text-base font-bold text-forest leading-tight">{c.campaignName}</h4>
                        <p className="text-xs text-forest/60 mt-1 font-medium">{c.ngoName} • {c.disasterName}</p>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1 font-semibold">
                          <span className="text-forest">{formatINR(fundsRaised)}</span>
                          <span className="text-forest/60">{formatINR(target)} Goal</span>
                        </div>
                        <div className="w-full h-1.5 bg-sand rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gold rounded-full" 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-forest/70 mb-4">
                      <div className="bg-sand/30 p-2 rounded-lg text-center">
                        <p className="font-bold text-forest">{c.resourcesDistributed.toLocaleString()}</p>
                        <p>Resources</p>
                      </div>
                      <div className="bg-sand/30 p-2 rounded-lg text-center">
                        <p className="font-bold text-forest">{c.beneficiariesServed.toLocaleString()}</p>
                        <p>Beneficiaries</p>
                      </div>
                    </div>

                    {/* Only show Donate button to Donors or unauthenticated public guests */}
                    {currentUser ? (
                      currentUser.role === 'DONOR' ? (
                        <a 
                          href="/dashboard/donor" 
                          className="block w-full text-center py-2 bg-gold text-forest font-bold text-sm rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Donate Now
                        </a>
                      ) : currentUser.role === 'GOVERNMENT_AUTHORITY' ? (
                        <a 
                          href="/dashboard/authority/campaigns" 
                          className="block w-full text-center py-2 bg-forest/10 hover:bg-forest/20 text-forest font-bold text-xs rounded-lg transition-colors"
                        >
                          Review in Authority Portal
                        </a>
                      ) : currentUser.role === 'NGO_ADMIN' || currentUser.role === 'NGO_OPERATOR' ? (
                        <a 
                          href="/dashboard/ngo" 
                          className="block w-full text-center py-2 bg-forest/10 hover:bg-forest/20 text-forest font-bold text-xs rounded-lg transition-colors"
                        >
                          Manage in NGO Portal
                        </a>
                      ) : null
                    ) : (
                      <a 
                        href="/login" 
                        className="block w-full text-center py-2 bg-gold text-forest font-bold text-sm rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Donate
                      </a>
                    )}
                  </div>
                );
              })
            )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FlowStep({ icon, label, sub }: { icon: string, label: string, sub: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 rounded-full bg-sand flex items-center justify-center text-xl mb-2 border border-forest/10">
        {icon}
      </div>
      <span className="text-xs font-bold text-forest">{label}</span>
      <span className="text-[10px] text-forest/60 font-medium">{sub}</span>
    </div>
  );
}

function FlowArrow() {
  return <div className="text-forest/30 text-lg">→</div>;
}
