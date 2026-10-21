import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReportFilters {
  disasterId?: string;
  startDate?: string;
  endDate?: string;
}

export const generateReport = async (filters: ReportFilters) => {
  const { disasterId, startDate, endDate } = filters;

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const campaignWhere: any = {};
  if (disasterId) {
    campaignWhere.disasterId = disasterId;
  }
  
  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    include: {
      disaster: true,
      ngo: true
    }
  });

  const campaignIds = campaigns.map(c => c.id);

  // Donations for funds raised — isolate INR from crypto assets
  const donationWhere: any = { campaignId: { in: campaignIds }, status: { in: ['CONFIRMED', 'Confirmed'] } };
  if (startDate || endDate) {
    donationWhere.createdAt = dateFilter;
  }
  const donations = await prisma.donation.findMany({
    where: donationWhere
  });

  // Calculate fiat INR total safely without mixing incompatible currencies
  const inrDonations = donations.filter(d => !d.currency || d.currency === 'INR');
  const totalFundsRaised = inrDonations.reduce((acc, d) => acc + Number(d.amount), 0);

  // Maintain separate per-currency totals
  const overallCurrencyTotals: Record<string, number> = {};
  donations.forEach(d => {
    const curr = d.currency || 'INR';
    overallCurrencyTotals[curr] = (overallCurrencyTotals[curr] || 0) + Number(d.amount);
  });

  // Allocations to get resource batches to get distributions
  const allocations = await prisma.allocation.findMany({
    where: { campaignId: { in: campaignIds } }
  });
  const allocationIds = allocations.map(a => a.id);

  const batches = await prisma.resourceBatch.findMany({
    where: { allocationId: { in: allocationIds } }
  });
  const batchIds = batches.map(b => b.id);

  const distributionWhere: any = { batchId: { in: batchIds }, status: 'CONFIRMED' };
  if (startDate || endDate) {
    distributionWhere.createdAt = dateFilter;
  }
  const distributions = await prisma.distribution.findMany({
    where: distributionWhere,
    include: { batch: true }
  });

  const totalResourcesDistributed = distributions.reduce((acc, d) => acc + new Prisma.Decimal(d.quantity.toString()).toNumber(), 0);
  const totalBeneficiariesServed = distributions.reduce((acc, d) => acc + d.beneficiaryCount, 0);

  // Breakdown by campaign
  const campaignBreakdown = campaigns.map(c => {
    const cDonations = donations.filter(d => d.campaignId === c.id);
    const cInrDonations = cDonations.filter(d => !d.currency || d.currency === 'INR');
    const cRaised = cInrDonations.length > 0
      ? cInrDonations.reduce((acc, d) => acc + Number(d.amount), 0)
      : Number(c.raisedAmount || 0);

    const cCurrencyTotals: Record<string, number> = {};
    cDonations.forEach(d => {
      const curr = d.currency || 'INR';
      cCurrencyTotals[curr] = (cCurrencyTotals[curr] || 0) + Number(d.amount);
    });
    
    const cAllocations = allocations.filter(a => a.campaignId === c.id).map(a => a.id);
    const cBatches = batches.filter(b => cAllocations.includes(b.allocationId)).map(b => b.id);
    const cDistributions = distributions.filter(d => cBatches.includes(d.batchId));
    
    const cResDist = cDistributions.reduce((acc, d) => acc + new Prisma.Decimal(d.quantity.toString()).toNumber(), 0);
    const cBenServed = cDistributions.reduce((acc, d) => acc + d.beneficiaryCount, 0);

    const target = Number(c.targetAmount || 100000);
    const progress = target > 0 ? (cRaised / target) * 100 : 0;

    return {
      campaignId: c.id,
      campaignName: c.name,
      disasterId: c.disasterId,
      disasterName: c.disaster?.name,
      ngoName: c.ngo?.name,
      targetAmount: target,
      fundsRaised: cRaised,
      raisedAmount: cRaised,
      currencyTotals: cCurrencyTotals,
      resourcesDistributed: cResDist,
      beneficiariesServed: cBenServed,
      progressPercentage: progress
    };
  });

  // Resource totals breakdown
  const resourceTotals: Record<string, number> = {};
  distributions.forEach(d => {
    const rType = d.batch.name;
    if (!resourceTotals[rType]) resourceTotals[rType] = 0;
    resourceTotals[rType] += new Prisma.Decimal(d.quantity.toString()).toNumber();
  });

  return {
    summary: {
      totalFundsRaised,
      currencyTotals: overallCurrencyTotals,
      totalResourcesDistributed,
      totalBeneficiariesServed
    },
    campaignBreakdown,
    resourceTotals: Object.keys(resourceTotals).map(k => ({ resource: k, total: resourceTotals[k] }))
  };
};

export const getPublicDashboard = async () => {
  // Only public/active data
  const disasters = await prisma.disaster.findMany({
    where: { status: { in: ['ACTIVE', 'Active'] } }
  });
  const disasterIds = disasters.map(d => d.id);

  const campaigns = await prisma.campaign.findMany({
    where: { disasterId: { in: disasterIds }, status: { in: ['ACTIVE', 'Active'] } },
    include: { disaster: true, ngo: true }
  });
  const campaignIds = campaigns.map(c => c.id);

  // We can just use the generateReport logic without dates
  const report = await generateReport({ });

  // Filter to only include active campaigns for the dashboard
  const activeBreakdown = report.campaignBreakdown.filter(c => campaignIds.includes(c.campaignId));
  
  const activeFunds = activeBreakdown.reduce((acc, c) => acc + c.fundsRaised, 0);
  const activeRes = activeBreakdown.reduce((acc, c) => acc + c.resourcesDistributed, 0);
  const activeBen = activeBreakdown.reduce((acc, c) => acc + c.beneficiariesServed, 0);

  return {
    activeDisasters: disasters.length,
    activeCampaigns: campaigns.length,
    totalFundsRaised: activeFunds,
    totalResourcesDistributed: activeRes,
    totalBeneficiariesServed: activeBen,
    campaigns: activeBreakdown,
    disasters: disasters.map(d => ({
      id: d.id,
      name: d.name,
      severity: d.severity,
      state: d.state,
      district: d.district,
      city: d.city,
      pinCode: d.pinCode
    }))
  };
};
