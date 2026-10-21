import prisma from '../../config/db';
import { createAuditLog } from '../../services/audit.service';
import { CreateCampaignDto, CampaignStatus, Web2Role, OrganizationType, DisasterStatus, DonationInfoResponse } from '@reliefchain/shared-types';
import { web3Service } from '../../services/web3.service';
import { uuidToBytes32 } from '../../utils/web3-format';

export const createCampaign = async (
  data: CreateCampaignDto,
  actorId: string,
  organizationId: string
) => {
  // 1. Verify organization is NGO and verified
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.type !== OrganizationType.NGO || !org.isVerified) {
    throw new Error('Invalid or unverified NGO organization');
  }

  // 2. Verify disaster is ACTIVE
  const disaster = await prisma.disaster.findUnique({ where: { id: data.disasterId } });
  if (!disaster) {
    throw new Error('Disaster not found');
  }
  if (disaster.status !== DisasterStatus.ACTIVE && disaster.status !== DisasterStatus.VERIFIED) {
    throw new Error(`Cannot create campaign for disaster in status: ${disaster.status}`);
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      disasterId: data.disasterId,
      ngoId: organizationId,
      status: CampaignStatus.PENDING_AUTHORITY_APPROVAL,
    },
  });

  await createAuditLog({
    actorId,
    action: 'CREATE_CAMPAIGN',
    entityType: 'Campaign',
    entityId: campaign.id,
    status: 'Success',
    metadata: { initialState: CampaignStatus.PENDING_AUTHORITY_APPROVAL },
  });

  return campaign;
};

export const getCampaigns = async () => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      disaster: {
        select: {
          id: true,
          name: true,
          status: true,
          severity: true,
          state: true,
          district: true,
          city: true,
          pinCode: true,
        }
      },
      ngo: {
        select: {
          id: true,
          name: true,
          type: true,
          isVerified: true,
          walletAddress: true,
        }
      },
      Donations: {
        where: {
          status: { in: ['CONFIRMED', 'Confirmed'] }
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
        }
      },
      Allocations: {
        select: {
          id: true,
          status: true,
          amount: true,
          ResourceBatches: {
            select: {
              id: true,
              totalQuantity: true,
              unit: true,
              Distributions: {
                select: {
                  id: true,
                  quantity: true,
                  beneficiaryCount: true,
                  status: true,
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return campaigns.map(c => {
    // Only INR donations contribute to INR raised amount
    const inrDonations = (c as any).Donations
      ? (c as any).Donations.filter((d: any) => !d.currency || d.currency === 'INR')
      : [];
    const totalRaised = inrDonations.length > 0
      ? inrDonations.reduce((sum: number, d: any) => sum + Number(d.amount), 0)
      : Number(c.raisedAmount || 0);

    // Compute separate currency aggregates
    const currencyTotals: Record<string, number> = {};
    if ((c as any).Donations) {
      (c as any).Donations.forEach((d: any) => {
        const curr = d.currency || 'INR';
        currencyTotals[curr] = (currencyTotals[curr] || 0) + Number(d.amount);
      });
    }
    
    let totalDistQuantity = 0;
    let totalBeneficiaries = 0;

    if ((c as any).Allocations) {
      (c as any).Allocations.forEach((a: any) => {
        if (a.ResourceBatches) {
          a.ResourceBatches.forEach((b: any) => {
            if (b.Distributions) {
              b.Distributions.forEach((d: any) => {
                totalDistQuantity += Number(d.quantity || 0);
                totalBeneficiaries += Number(d.beneficiaryCount || 0);
              });
            }
          });
        }
      });
    }

    const target = Number(c.targetAmount || 0);
    const progress = target > 0 ? (totalRaised / target) * 100 : 0;

    return {
      ...c,
      targetAmount: target,
      raisedAmount: totalRaised,
      fundsRaised: totalRaised, // Primary field expected by dashboards
      currencyTotals,
      resourcesDistributed: totalDistQuantity,
      beneficiariesServed: totalBeneficiaries,
      progressPercentage: progress,
    };
  });
};

export const getCampaignById = async (id: string) => {
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      disaster: {
        select: {
          id: true,
          name: true,
          status: true,
          severity: true,
          state: true,
          district: true,
          city: true,
          pinCode: true,
        }
      },
      ngo: {
        select: {
          id: true,
          name: true,
          type: true,
          isVerified: true,
          walletAddress: true,
        }
      },
      Donations: {
        where: {
          status: { in: ['CONFIRMED', 'Confirmed'] }
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
        }
      },
      Allocations: {
        select: {
          id: true,
          status: true,
          amount: true,
          ResourceBatches: {
            select: {
              id: true,
              totalQuantity: true,
              unit: true,
              Distributions: {
                select: {
                  id: true,
                  quantity: true,
                  beneficiaryCount: true,
                  status: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!c) throw new Error('Campaign not found');

  const inrDonations = (c as any).Donations
    ? (c as any).Donations.filter((d: any) => !d.currency || d.currency === 'INR')
    : [];
  const totalRaised = inrDonations.length > 0
    ? inrDonations.reduce((sum: number, d: any) => sum + Number(d.amount), 0)
    : Number(c.raisedAmount || 0);

  const currencyTotals: Record<string, number> = {};
  if ((c as any).Donations) {
    (c as any).Donations.forEach((d: any) => {
      const curr = d.currency || 'INR';
      currencyTotals[curr] = (currencyTotals[curr] || 0) + Number(d.amount);
    });
  }

  let totalDistQuantity = 0;
  let totalBeneficiaries = 0;

  if ((c as any).Allocations) {
    (c as any).Allocations.forEach((a: any) => {
      if (a.ResourceBatches) {
        a.ResourceBatches.forEach((b: any) => {
          if (b.Distributions) {
            b.Distributions.forEach((d: any) => {
              totalDistQuantity += Number(d.quantity || 0);
              totalBeneficiaries += Number(d.beneficiaryCount || 0);
            });
          }
        });
      }
    });
  }

  const target = Number(c.targetAmount || 0);
  const progress = target > 0 ? (totalRaised / target) * 100 : 0;

  return {
    ...c,
    targetAmount: target,
    raisedAmount: totalRaised,
    fundsRaised: totalRaised,
    currencyTotals,
    resourcesDistributed: totalDistQuantity,
    beneficiariesServed: totalBeneficiaries,
    progressPercentage: progress,
  };
};

export const reconcileCampaign = async (campaignId: string, actorId?: string) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Row-level lock on Campaign to serialize concurrent reconciliation and donation updates
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;

    const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');

    // 2. Sum confirmed INR donations for the campaign total
    const aggregate = await tx.donation.aggregate({
      where: {
        campaignId,
        status: { in: ['CONFIRMED', 'Confirmed'] },
        currency: 'INR'
      },
      _sum: { amount: true }
    });

    const confirmedSum = aggregate._sum.amount ? aggregate._sum.amount.toNumber() : 0;

    const updated = await tx.campaign.update({
      where: { id: campaignId },
      data: { raisedAmount: confirmedSum }
    });

    await createAuditLog({
      actorId: actorId || 'SYSTEM',
      action: 'RECONCILE_CAMPAIGN',
      entityType: 'Campaign',
      entityId: campaignId,
      status: 'Success',
      metadata: {
        previousRaisedAmount: Number(campaign.raisedAmount || 0),
        newRaisedAmount: confirmedSum,
        currency: 'INR'
      }
    });

    return {
      campaignId,
      raisedAmount: confirmedSum,
      targetAmount: Number(updated.targetAmount),
      progressPercentage: Number(updated.targetAmount) > 0 ? (confirmedSum / Number(updated.targetAmount)) * 100 : 0
    };
  });
};

export const reconcileAllCampaigns = async (actorId?: string) => {
  const campaigns = await prisma.campaign.findMany({ select: { id: true } });
  const results = [];
  for (const c of campaigns) {
    results.push(await reconcileCampaign(c.id, actorId));
  }

  await createAuditLog({
    actorId: actorId || 'SYSTEM',
    action: 'RECONCILE_ALL_CAMPAIGNS',
    entityType: 'System',
    status: 'Success',
    metadata: {
      campaignCount: campaigns.length,
      timestamp: new Date().toISOString()
    }
  });

  return results;
};

const validateTransition = (current: string, next: CampaignStatus) => {
  const transitions: Record<string, CampaignStatus[]> = {
    [CampaignStatus.DRAFT]: [CampaignStatus.PENDING_AUTHORITY_APPROVAL],
    [CampaignStatus.PENDING_AUTHORITY_APPROVAL]: [CampaignStatus.ACTIVE],
    [CampaignStatus.ACTIVE]: [CampaignStatus.PAUSED, CampaignStatus.CLOSED],
    [CampaignStatus.PAUSED]: [CampaignStatus.ACTIVE, CampaignStatus.CLOSED],
    [CampaignStatus.CLOSED]: [], // Terminal state
  };

  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid state transition from ${current} to ${next}`);
  }
};

export const approveCampaign = async (campaignId: string, actorId: string, organizationId: string) => {
  // 1. Verify authority
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.type !== OrganizationType.GOVERNMENT || !org.isVerified) {
    throw new Error('Invalid or unverified Government Authority');
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  try {
    validateTransition(campaign.status, CampaignStatus.ACTIVE);
  } catch (error: any) {
    await createAuditLog({
      actorId,
      action: 'APPROVE_CAMPAIGN',
      entityType: 'Campaign',
      entityId: campaignId,
      status: 'Failure',
      metadata: { error: error.message },
    });
    throw error;
  }

  // Verify associated disaster is STILL ACTIVE
  const disaster = await prisma.disaster.findUnique({ where: { id: campaign.disasterId } });
  if (!disaster || disaster.status !== DisasterStatus.ACTIVE) {
    const errorMsg = 'Associated disaster is no longer ACTIVE';
    await createAuditLog({
      actorId,
      action: 'APPROVE_CAMPAIGN',
      entityType: 'Campaign',
      entityId: campaignId,
      status: 'Failure',
      metadata: { error: errorMsg },
    });
    throw new Error(errorMsg);
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.ACTIVE },
  });

  await createAuditLog({
    actorId,
    action: 'APPROVE_CAMPAIGN',
    entityType: 'Campaign',
    entityId: campaignId,
    status: 'Success',
    metadata: { previousState: campaign.status, newState: CampaignStatus.ACTIVE },
  });

  return updated;
};

const transitionAsOwner = async (
  campaignId: string,
  nextState: CampaignStatus,
  actorId: string,
  organizationId: string,
  action: string
) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.ngoId !== organizationId) {
    const errorMsg = 'Not authorized to modify this campaign';
    await createAuditLog({
      actorId,
      action,
      entityType: 'Campaign',
      entityId: campaignId,
      status: 'Failure',
      metadata: { error: errorMsg },
    });
    throw new Error(errorMsg);
  }

  try {
    validateTransition(campaign.status, nextState);
  } catch (error: any) {
    await createAuditLog({
      actorId,
      action,
      entityType: 'Campaign',
      entityId: campaignId,
      status: 'Failure',
      metadata: { error: error.message },
    });
    throw error;
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: nextState },
  });

  await createAuditLog({
    actorId,
    action,
    entityType: 'Campaign',
    entityId: campaignId,
    status: 'Success',
    metadata: { previousState: campaign.status, newState: nextState },
  });

  return updated;
};

export const pauseCampaign = async (campaignId: string, actorId: string, organizationId: string) => {
  return await transitionAsOwner(campaignId, CampaignStatus.PAUSED, actorId, organizationId, 'PAUSE_CAMPAIGN');
};

export const resumeCampaign = async (campaignId: string, actorId: string, organizationId: string) => {
  return await transitionAsOwner(campaignId, CampaignStatus.ACTIVE, actorId, organizationId, 'RESUME_CAMPAIGN');
};

export const closeCampaign = async (campaignId: string, actorId: string, organizationId: string) => {
  return await transitionAsOwner(campaignId, CampaignStatus.CLOSED, actorId, organizationId, 'CLOSE_CAMPAIGN');
};

export const getDonationInfo = async (campaignId: string): Promise<DonationInfoResponse> => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw new Error(`Cannot donate to campaign in status: ${campaign.status}`);
  }

  const disaster = await prisma.disaster.findUnique({ where: { id: campaign.disasterId } });
  if (!disaster || disaster.status !== DisasterStatus.ACTIVE) {
    throw new Error('Associated disaster is no longer ACTIVE');
  }

  return {
    chainId: web3Service.expectedChainId,
    donationContractAddress: web3Service.donationContractAddress,
    blockchainCampaignId: uuidToBytes32(campaign.id),
    targetAmount: campaign.targetAmount.toString(),
    raisedAmount: campaign.raisedAmount.toString(),
    status: campaign.status,
  };
};

export const getAvailableBalance = async (campaignId: string) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Calculate sum of active allocations
  const activeAllocations = await prisma.allocation.aggregate({
    where: {
      campaignId,
      status: {
        in: ['DRAFT', 'PENDING_MULTISIG', 'APPROVED', 'EXECUTING', 'CONFIRMED']
      }
    },
    _sum: {
      amount: true
    }
  });

  const reservedAmount = activeAllocations._sum.amount || 0;
  
  // Available Balance = Campaign.raisedAmount (which strictly represents on-chain Escrow via M6) - ReservedAmount
  const availableBalance = campaign.raisedAmount.toNumber() - Number(reservedAmount);

  return {
    campaignId: campaign.id,
    raisedAmount: campaign.raisedAmount.toString(),
    reservedAmount: reservedAmount.toString(),
    availableBalance: Math.max(0, availableBalance).toString(), // Ensure it doesn't go below 0 visually due to any decimal quirk, though shouldn't happen
  };
};
