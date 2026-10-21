'use client';
import { useEffect, useState } from 'react';

export default function GlobalKPIs() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/public/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse bg-white/50 h-24 rounded-2xl mb-8"></div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <KPICard 
        label="Active Disasters" 
        value={data.activeDisasters} 
        variant="forest"
        subtext="Ongoing relief"
        icon="⚠️"
      />
      <KPICard 
        label="Active Campaigns" 
        value={data.activeCampaigns} 
        variant="gold"
        subtext="Accepting donations"
        icon="📢"
      />
      <KPICard 
        label="Total Funds Raised" 
        value={`₹${(data.totalFundsRaised || 0).toLocaleString('en-IN')}`} 
        variant="terracotta"
        subtext="Public contributions"
        icon="₹"
      />
      <KPICard 
        label="Resources Dist." 
        value={(data.totalResourcesDistributed || 0).toLocaleString('en-IN')} 
        variant="white"
        subtext="Units delivered"
        icon="📦"
      />
      <KPICard 
        label="Beneficiaries" 
        value={(data.totalBeneficiariesServed || 0).toLocaleString('en-IN')} 
        variant="white"
        subtext="People assisted"
        icon="👥"
      />
    </div>
  );
}

function KPICard({ label, value, variant, subtext, icon }: { label: string; value: string | number, variant: 'forest' | 'gold' | 'terracotta' | 'white', subtext?: string, icon?: string }) {
  let bg = "";
  let text = "";
  let subtextColor = "";

  switch (variant) {
    case 'forest':
      bg = "bg-forest border-forest";
      text = "text-sand";
      subtextColor = "text-sand/70";
      break;
    case 'gold':
      bg = "bg-gold border-gold";
      text = "text-forest";
      subtextColor = "text-forest/70";
      break;
    case 'terracotta':
      bg = "bg-terracotta border-terracotta";
      text = "text-white";
      subtextColor = "text-white/80";
      break;
    case 'white':
      bg = "bg-white border-forest/10 shadow-sm";
      text = "text-forest";
      subtextColor = "text-forest/60";
      break;
  }

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between min-w-0 overflow-hidden ${bg} transition-transform hover:-translate-y-1`}>
      <div className="flex justify-between items-start gap-2 mb-3 min-w-0">
        <p className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 min-w-0 ${subtextColor}`}>{label}</p>
        {icon && <span className="text-lg sm:text-xl opacity-80 shrink-0 select-none">{icon}</span>}
      </div>
      <div className="min-w-0">
        <p className={`text-xl sm:text-2xl xl:text-3xl font-bold ${text} tracking-tight truncate`} title={String(value)}>{value}</p>
        {subtext && <p className={`text-[11px] sm:text-xs mt-1 font-medium truncate ${subtextColor}`}>{subtext}</p>}
      </div>
    </div>
  );
}
