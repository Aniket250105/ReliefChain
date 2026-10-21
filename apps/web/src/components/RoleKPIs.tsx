'use client';
import { useEffect, useState } from 'react';
import { getCachedData, isCacheFresh, setCachedData, subscribeToCacheInvalidation } from '../lib/api-cache';

interface RoleKPIProps {
  role: string;
}

interface KPIData {
  label: string;
  value: string | number;
  variant: 'forest' | 'gold' | 'terracotta' | 'white';
  subtext: string;
  icon: string;
}

export default function RoleKPIs({ role }: RoleKPIProps) {
  const cacheKey = `kpi_${role}`;
  const cached = getCachedData<KPIData[]>(cacheKey);
  const [kpis, setKpis] = useState<KPIData[]>(() => cached || []);
  const [loading, setLoading] = useState(() => !cached || cached.length === 0);

  useEffect(() => {
    let isMounted = true;

    const loadKpis = () => {
      fetchRoleKPIs(role)
        .then(data => {
          if (isMounted) {
            setCachedData(cacheKey, data);
            setKpis(data);
            setLoading(false);
          }
        })
        .catch(err => {
          console.error(err);
          if (isMounted) setLoading(false);
        });
    };

    loadKpis();

    const unsubscribe = subscribeToCacheInvalidation(() => {
      loadKpis();
    });
    const interval = setInterval(loadKpis, 5000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [role, cacheKey]);

  if (loading) return <div className="animate-pulse bg-white/50 h-24 rounded-2xl mb-8"></div>;
  if (kpis.length === 0) return null;

  const gridCols = kpis.length <= 3
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-3 sm:gap-4 mb-6 sm:mb-8`}>
      {kpis.map((kpi, i) => (
        <KPICard key={i} {...kpi} />
      ))}
    </div>
  );
}

async function fetchRoleKPIs(role: string): Promise<KPIData[]> {
  try {
    switch (role) {
      case 'DONOR': {
        const [donRes, campRes] = await Promise.all([
          fetch('/api/donations/my-donations', { credentials: 'include' }).catch(() => null),
          fetch('/api/campaigns').catch(() => null)
        ]);

        let totalDonated = 0;
        let donationCount = 0;
        let confirmedCount = 0;

        if (donRes && donRes.ok) {
          const donations = await donRes.json();
          if (Array.isArray(donations)) {
            donationCount = donations.length;
            confirmedCount = donations.filter((d: any) => d.status === 'CONFIRMED' || d.status === 'Confirmed').length;
            totalDonated = donations
              .filter((d: any) => d.status === 'CONFIRMED' || d.status === 'Confirmed')
              .reduce((sum: number, d: any) => sum + Number(d.amount), 0);
          }
        }

        let activeCampaigns = 0;
        if (campRes && campRes.ok) {
          const campaigns = await campRes.json();
          if (Array.isArray(campaigns)) {
            activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE' || c.status === 'Active').length;
          }
        }

        return [
          { label: 'My Total Donated', value: `₹${totalDonated.toLocaleString('en-IN')}`, variant: 'terracotta', subtext: 'Confirmed contributions', icon: '💰' },
          { label: 'My Donations', value: donationCount, variant: 'forest', subtext: `${confirmedCount} confirmed`, icon: '🧾' },
          { label: 'Active Campaigns', value: activeCampaigns, variant: 'gold', subtext: 'Open for donations', icon: '📢' },
        ];
      }

      case 'GOVERNMENT_AUTHORITY': {
        const [disRes, campRes, allocRes] = await Promise.all([
          fetch('/api/disasters', { credentials: 'include' }).catch(() => null),
          fetch('/api/campaigns', { credentials: 'include' }).catch(() => null),
          fetch('/api/allocations/authority', { credentials: 'include' }).catch(() => null)
        ]);

        let totalDisasters = 0;
        let activeDisasters = 0;
        let pendingVerification = 0;
        if (disRes && disRes.ok) {
          const disasters = await disRes.json();
          if (Array.isArray(disasters)) {
            totalDisasters = disasters.length;
            activeDisasters = disasters.filter((d: any) => d.status === 'ACTIVE' || d.status === 'Active' || d.status === 'VERIFIED').length;
            pendingVerification = disasters.filter((d: any) => d.status === 'PENDING_VERIFICATION').length;
          }
        }

        let pendingCampaigns = 0;
        let activeCampaigns = 0;
        if (campRes && campRes.ok) {
          const campaigns = await campRes.json();
          if (Array.isArray(campaigns)) {
            pendingCampaigns = campaigns.filter((c: any) => c.status === 'PENDING' || c.status === 'PENDING_AUTHORITY_APPROVAL').length;
            activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE' || c.status === 'Active').length;
          }
        }

        let pendingAllocations = 0;
        if (allocRes && allocRes.ok) {
          const allocs = await allocRes.json();
          if (Array.isArray(allocs)) {
            pendingAllocations = allocs.filter((a: any) => a.status === 'PENDING_MULTISIG').length;
          }
        }

        return [
          { label: 'Active Disasters', value: activeDisasters, variant: 'terracotta', subtext: `${pendingVerification} pending verification`, icon: '⚠️' },
          { label: 'Active Campaigns', value: activeCampaigns, variant: 'gold', subtext: `${pendingCampaigns} awaiting approval`, icon: '📢' },
          { label: 'Total Disasters', value: totalDisasters, variant: 'forest', subtext: 'All time records', icon: '📋' },
          { label: 'Pending Multisig', value: pendingAllocations, variant: 'white', subtext: 'Awaiting your signature', icon: '✍️' },
        ];
      }

      case 'NGO_ADMIN':
      case 'NGO_OPERATOR': {
        const [campRes, allocRes] = await Promise.all([
          fetch('/api/campaigns', { credentials: 'include' }).catch(() => null),
          fetch('/api/allocations', { credentials: 'include' }).catch(() => null)
        ]);

        let myCampaigns = 0;
        let totalRaised = 0;
        if (campRes && campRes.ok) {
          const campaigns = await campRes.json();
          if (Array.isArray(campaigns)) {
            myCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE' || c.status === 'Active').length;
            totalRaised = campaigns.reduce((sum: number, c: any) => sum + Number(c.fundsRaised ?? c.raisedAmount ?? 0), 0);
          }
        }

        let allocCount = 0;
        let pendingAllocations = 0;
        if (allocRes && allocRes.ok) {
          const allocs = await allocRes.json();
          if (Array.isArray(allocs)) {
            allocCount = allocs.length;
            pendingAllocations = allocs.filter((a: any) => a.status === 'PENDING_MULTISIG' || a.status === 'DRAFT').length;
          }
        }

        return [
          { label: 'Active Campaigns', value: myCampaigns, variant: 'forest', subtext: 'Accepting donations', icon: '📢' },
          { label: 'Campaign Funds', value: `₹${totalRaised.toLocaleString('en-IN')}`, variant: 'terracotta', subtext: 'Across campaigns', icon: '₹' },
          { label: 'Total Allocations', value: allocCount, variant: 'gold', subtext: `${pendingAllocations} in progress`, icon: '📦' },
        ];
      }

      case 'SUPPLIER': {
        const batchRes = await fetch('/api/resources/supplier', { credentials: 'include' }).catch(() => null);

        let totalBatches = 0;
        let inTransit = 0;
        let delivered = 0;
        let totalUnits = 0;
        if (batchRes && batchRes.ok) {
          const batches = await batchRes.json();
          if (Array.isArray(batches)) {
            totalBatches = batches.length;
            inTransit = batches.filter((b: any) => b.status === 'IN_TRANSIT').length;
            delivered = batches.filter((b: any) =>
              b.status === 'RECEIVED_WAREHOUSE' || b.status === 'RECEIVED_RELIEF_CENTER'
            ).length;
            totalUnits = batches.reduce((sum: number, b: any) => sum + Number(b.totalQuantity || 0), 0);
          }
        }

        return [
          { label: 'My Batches', value: totalBatches, variant: 'forest', subtext: 'Registered batches', icon: '📦' },
          { label: 'In Transit', value: inTransit, variant: 'gold', subtext: 'En route to warehouse', icon: '🚚' },
          { label: 'Delivered', value: delivered, variant: 'white', subtext: 'Received at destination', icon: '✅' },
          { label: 'Total Units', value: totalUnits.toLocaleString('en-IN'), variant: 'terracotta', subtext: 'Supplied to date', icon: '📊' },
        ];
      }

      case 'WAREHOUSE_OPERATOR': {
        const [invRes, batchRes] = await Promise.all([
          fetch('/api/inventory', { credentials: 'include' }).catch(() => null),
          fetch('/api/resources/warehouse', { credentials: 'include' }).catch(() => null)
        ]);

        let totalItems = 0;
        let totalStock = 0;
        let lowStockCount = 0;
        if (invRes && invRes.ok) {
          const inventory = await invRes.json();
          if (Array.isArray(inventory)) {
            totalItems = inventory.length;
            totalStock = inventory.reduce((sum: number, i: any) => sum + Number(i.currentQuantity || 0), 0);
            lowStockCount = inventory.filter((i: any) => Number(i.currentQuantity) < 100).length;
          }
        }

        let inTransit = 0;
        let received = 0;
        if (batchRes && batchRes.ok) {
          const batches = await batchRes.json();
          if (Array.isArray(batches)) {
            inTransit = batches.filter((b: any) => b.status === 'IN_TRANSIT').length;
            received = batches.filter((b: any) => b.status === 'RECEIVED_WAREHOUSE').length;
          }
        }

        return [
          { label: 'Items in Stock', value: totalItems, variant: 'forest', subtext: `${lowStockCount} low stock alerts`, icon: '📦' },
          { label: 'Total Units', value: totalStock.toLocaleString('en-IN'), variant: 'gold', subtext: 'Available quantity', icon: '🏷️' },
          { label: 'Incoming', value: inTransit, variant: 'terracotta', subtext: 'Shipments en route', icon: '🚚' },
          { label: 'Received', value: received, variant: 'white', subtext: 'Batches logged', icon: '✅' },
        ];
      }

      case 'RELIEF_OFFICER': {
        const [distRes, invRes] = await Promise.all([
          fetch('/api/distributions', { credentials: 'include' }).catch(() => null),
          fetch('/api/inventory', { credentials: 'include' }).catch(() => null)
        ]);

        let totalDistributed = 0;
        let totalBeneficiaries = 0;
        let distCount = 0;
        if (distRes && distRes.ok) {
          const distributions = await distRes.json();
          if (Array.isArray(distributions)) {
            distCount = distributions.length;
            totalDistributed = distributions.reduce((sum: number, d: any) => sum + Number(d.quantity || 0), 0);
            totalBeneficiaries = distributions.reduce((sum: number, d: any) => sum + Number(d.beneficiaryCount || 0), 0);
          }
        }

        let availableBatches = 0;
        if (invRes && invRes.ok) {
          const inv = await invRes.json();
          if (Array.isArray(inv)) {
            availableBatches = inv.filter((i: any) => Number(i.currentQuantity) > 0).length;
          }
        }

        return [
          { label: 'Distributions', value: distCount, variant: 'forest', subtext: 'Completed records', icon: '📋' },
          { label: 'Units Delivered', value: totalDistributed.toLocaleString('en-IN'), variant: 'terracotta', subtext: 'Relief materials', icon: '📦' },
          { label: 'People Helped', value: totalBeneficiaries.toLocaleString('en-IN'), variant: 'gold', subtext: 'Beneficiaries assisted', icon: '👥' },
          { label: 'Available Stock', value: availableBatches, variant: 'white', subtext: 'Items ready to distribute', icon: '🏷️' },
        ];
      }

      case 'AUDITOR': {
        const alertsRes = await fetch('/api/ai/alerts', { credentials: 'include' }).catch(() => null);

        let totalAlerts = 0;
        let newAlerts = 0;
        let highRisk = 0;
        let resolved = 0;
        if (alertsRes && alertsRes.ok) {
          const alerts = await alertsRes.json();
          if (Array.isArray(alerts)) {
            totalAlerts = alerts.length;
            newAlerts = alerts.filter((a: any) => a.status === 'NEW').length;
            highRisk = alerts.filter((a: any) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL').length;
            resolved = alerts.filter((a: any) => a.status === 'RESOLVED_FALSE_POSITIVE').length;
          }
        }

        return [
          { label: 'Open Alerts', value: newAlerts, variant: 'terracotta', subtext: `${highRisk} high/critical`, icon: '🔔' },
          { label: 'Total Alerts', value: totalAlerts, variant: 'forest', subtext: 'All time', icon: '📊' },
          { label: 'Resolved', value: resolved, variant: 'gold', subtext: 'Marked false positive', icon: '✅' },
        ];
      }

      case 'SYSTEM_ADMIN': {
        const [disRes, campRes, orgRes, alertsRes] = await Promise.all([
          fetch('/api/disasters', { credentials: 'include' }).catch(() => null),
          fetch('/api/campaigns', { credentials: 'include' }).catch(() => null),
          fetch('/api/organizations', { credentials: 'include' }).catch(() => null),
          fetch('/api/ai/alerts', { credentials: 'include' }).catch(() => null),
        ]);

        let disasterCount = 0;
        if (disRes && disRes.ok) {
          const d = await disRes.json();
          if (Array.isArray(d)) disasterCount = d.length;
        }

        let campaignCount = 0;
        if (campRes && campRes.ok) {
          const c = await campRes.json();
          if (Array.isArray(c)) campaignCount = c.length;
        }

        let orgCount = 0;
        if (orgRes && orgRes.ok) {
          const o = await orgRes.json();
          if (Array.isArray(o)) orgCount = o.length;
        }

        let openAlerts = 0;
        if (alertsRes && alertsRes.ok) {
          const a = await alertsRes.json();
          if (Array.isArray(a)) openAlerts = a.filter((item: any) => item.status === 'NEW').length;
        }

        return [
          { label: 'Registered Orgs', value: orgCount, variant: 'forest', subtext: 'NGOs & Authorities', icon: '🏛️' },
          { label: 'Disaster Records', value: disasterCount, variant: 'terracotta', subtext: 'Tracked disasters', icon: '⚠️' },
          { label: 'Total Campaigns', value: campaignCount, variant: 'gold', subtext: 'Across platform', icon: '📢' },
          { label: 'System Alerts', value: openAlerts, variant: 'white', subtext: 'Requires review', icon: '🛡️' },
        ];
      }

      default:
        return [];
    }
  } catch (err) {
    console.error('Failed to fetch role KPIs:', err);
    return [];
  }
}

function KPICard({ label, value, variant, subtext, icon }: KPIData) {
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
