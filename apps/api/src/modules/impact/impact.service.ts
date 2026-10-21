import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const getDonorImpact = async (donationId: string) => {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { campaign: true }
  });

  if (!donation) {
    throw new Error('Donation not found');
  }

  const campaign = donation.campaign;
  const targetAmount = new Prisma.Decimal(campaign.targetAmount.toString());
  const raisedAmount = new Prisma.Decimal(campaign.raisedAmount.toString());
  const donorAmount = new Prisma.Decimal(donation.amount.toString());

  let donorShare = new Prisma.Decimal(0);
  if (raisedAmount.greaterThan(0)) {
    donorShare = donorAmount.div(raisedAmount);
  }

  // Find allocations linked to this campaign
  const allocations = await prisma.allocation.findMany({
    where: { campaignId: campaign.id },
    include: { requester: true },
    orderBy: { createdAt: 'asc' }
  });

  const allocationIds = allocations.map(a => a.id);

  // Find resource batches for those allocations
  const resourceBatches = await prisma.resourceBatch.findMany({
    where: { allocationId: { in: allocationIds } },
    orderBy: { createdAt: 'asc' }
  });
  
  const batchIds = resourceBatches.map(rb => rb.id);

  // Find distributions for those resource batches
  const distributions = await prisma.distribution.findMany({
    where: { 
      batchId: { in: batchIds },
      status: 'CONFIRMED'
    },
    include: { batch: true },
    orderBy: { createdAt: 'asc' }
  });

  // Build the result timeline
  const result = {
    donationId: donation.id,
    campaignId: campaign.id,
    campaignTitle: campaign.name,
    donorContribution: donorAmount.toNumber(),
    campaignTotalRaised: raisedAmount.toNumber(),
    donorPercentage: donorShare.mul(100).toNumber(),
    allocations: allocations.map(a => ({
      allocationId: a.id,
      purpose: `Allocation to ${a.requester.name}`,
      amount: new Prisma.Decimal(a.amount.toString()).toNumber(),
      attributedAmount: new Prisma.Decimal(a.amount.toString()).mul(donorShare).toNumber(),
      blockchainTxHash: a.executionTxHash,
      status: a.status
    })),
    resourceBatches: resourceBatches.map(rb => ({
      batchId: rb.id,
      allocationId: rb.allocationId,
      resourceType: rb.name,
      quantity: rb.totalQuantity,
      unit: rb.unit,
      blockchainTxHash: rb.blockchainTxHash,
      status: rb.status
    })),
    distributions: distributions.map(d => ({
      distributionId: d.id,
      batchId: d.batchId,
      distributedQuantity: new Prisma.Decimal(d.quantity.toString()).toNumber(),
      beneficiariesServed: d.beneficiaryCount,
      attributedQuantity: new Prisma.Decimal(d.quantity.toString()).mul(donorShare).toNumber(),
      attributedBeneficiaries: new Prisma.Decimal(d.beneficiaryCount).mul(donorShare).toNumber(),
      blockchainTxHash: d.blockchainTxHash,
      status: d.status
    }))
  };

  return result;
}
