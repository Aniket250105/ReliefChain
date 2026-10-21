import prisma from '../../config/db';
import { createAuditLog } from '../../services/audit.service';
import { OrganizationType, CampaignStatus } from '@reliefchain/shared-types';
import { uuidToBytes32 } from '../../utils/web3-format';
import { getAvailableBalance } from '../campaigns/campaigns.service';
import { web3Service } from '../../services/web3.service';

export const createAllocation = async (
  data: { campaignId: string; amount: number; purpose?: string; payee?: string },
  actorId: string,
  organizationId: string
) => {
  // 1. Verify organization is NGO
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org || org.type !== OrganizationType.NGO || !org.isVerified) {
    throw new Error('Invalid NGO organization');
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      // Use a serializable transaction to prevent concurrent over-commitment
      return await prisma.$transaction(async (tx) => {
        // 2. Lock the campaign row for update
        const campaigns = await tx.$queryRaw<any[]>`SELECT * FROM "Campaign" WHERE id = ${data.campaignId} FOR UPDATE`;
        if (campaigns.length === 0) {
          throw new Error('Campaign not found');
        }
        const campaign = campaigns[0];

        // 3. Verify ownership & status
        if (campaign.ngoId !== organizationId) {
          throw new Error('Not authorized to allocate funds from this campaign');
        }
        if (campaign.status !== CampaignStatus.ACTIVE) {
          throw new Error(`Cannot allocate from campaign in status: ${campaign.status}`);
        }

        // 4. Calculate available balance with reservations
        const activeAllocations = await tx.allocation.aggregate({
          where: {
            campaignId: data.campaignId,
            status: {
              in: ['DRAFT', 'PENDING_MULTISIG', 'APPROVED', 'EXECUTING', 'CONFIRMED']
            }
          },
          _sum: {
            amount: true
          }
        });

        const reservedAmount = activeAllocations._sum.amount || 0;
        const availableBalance = Number(campaign.raisedAmount) - Number(reservedAmount);

        // 5. Verify amount
        if (data.amount > availableBalance) {
          throw new Error('Requested amount exceeds available balance');
        }

        // 6. Create allocation (DRAFT)
        const allocation = await tx.allocation.create({
          data: {
            campaignId: data.campaignId,
            requesterId: organizationId,
            amount: data.amount,
            status: 'DRAFT'
          }
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CREATE_ALLOCATION',
            entityType: 'Allocation',
            entityId: allocation.id,
            status: 'Success',
            metadata: { amount: data.amount, status: 'DRAFT' }
          }
        });

        return {
          ...allocation,
          blockchainId: uuidToBytes32(allocation.id),
          blockchainCampaignId: uuidToBytes32(campaign.id)
        };
      }, {
        isolationLevel: 'Serializable'
      });
    } catch (error: any) {
      // Prisma error code P2034 indicates a transaction failed due to a write conflict or a deadlock
      if (error.code === 'P2034') {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          throw new Error('Failed to create allocation due to high concurrency. Please try again.');
        }
        // Small backoff before retrying
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        continue;
      }
      // Re-throw non-serialization errors
      throw error;
    }
  }
  
  throw new Error('Failed to create allocation due to high concurrency. Please try again.');
};

export const getAllocations = async (organizationId?: string | null, role?: string | null) => {
  const where: any = {};
  if ((role === 'NGO_ADMIN' || role === 'NGO_OPERATOR') && organizationId) {
    where.campaign = { ngoId: organizationId };
  }
  // For Supplier, Auditor, System Admin, Government Authority, etc., return all allocations
  const allocations = await prisma.allocation.findMany({
    where,
    include: {
      MultisigApprovals: true,
      campaign: {
        include: {
          ngo: true,
          disaster: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return allocations.map(a => ({
    ...a,
    blockchainId: uuidToBytes32(a.id),
    blockchainCampaignId: uuidToBytes32(a.campaignId)
  }));
};

export const getAuthorityAllocations = async (authorityOrgId?: string | null) => {
  const allocations = await prisma.allocation.findMany({
    include: {
      MultisigApprovals: true,
      campaign: {
        include: {
          ngo: true,
          disaster: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return allocations.map(a => ({
    ...a,
    blockchainId: uuidToBytes32(a.id),
    blockchainCampaignId: uuidToBytes32(a.campaignId)
  }));
};

export const getAllocationById = async (id: string, organizationId?: string | null) => {
  const allocation = await prisma.allocation.findUnique({
    where: { id },
    include: {
      MultisigApprovals: true,
      campaign: {
        include: {
          ngo: true,
          disaster: true,
        }
      }
    }
  });
  if (!allocation) throw new Error('Allocation not found');
  
  return {
    ...allocation,
    blockchainId: uuidToBytes32(allocation.id),
    blockchainCampaignId: uuidToBytes32(allocation.campaign.id)
  };
};

export const markExecuting = async (id: string, executionTxHash: string, actorId: string) => {
  // We only allow marking EXECUTING if it's currently APPROVED
  // And we do a basic syntax check on txHash
  if (!web3Service.isValidTransactionHash(executionTxHash)) {
    throw new Error('Invalid transaction hash format');
  }

  const allocation = await prisma.allocation.findUnique({ where: { id } });
  if (!allocation) throw new Error('Allocation not found');

  if (allocation.status !== 'APPROVED') {
    throw new Error('Allocation is not in APPROVED state');
  }

  // INDEPENDENT VERIFICATION OF PENDING TRANSACTION
  try {
    const tx = await web3Service.getProvider().getTransaction(executionTxHash);
    if (!tx) {
      throw new Error('Transaction not found on configured network');
    }

    if (Number(tx.chainId) !== web3Service.expectedChainId) {
      throw new Error('Transaction is on incorrect network');
    }

    // Since execution uses the Multisig contract, verify destination is correct
    // Note: web3Service currently tracks donationContractAddress; if there's a dedicated 
    // multisig address in the config, it should be checked. Assuming we check `tx.to` is valid.
    if (!tx.to) {
      throw new Error('Transaction missing destination address');
    }

    // Decode or at least check if allocationId is present in calldata (simplified check for mempool)
    const expectedAllocationId = uuidToBytes32(id);
    if (!tx.data.includes(expectedAllocationId.replace('0x', ''))) {
      throw new Error('Transaction does not contain the correct allocation ID in its payload');
    }
  } catch (err: any) {
    throw new Error(`Transaction verification failed: ${err.message}`);
  }

  const updated = await prisma.allocation.update({
    where: { id },
    data: {
      status: 'EXECUTING',
      executionTxHash
    }
  });

  await createAuditLog({
    actorId,
    action: 'MARK_ALLOCATION_EXECUTING',
    entityType: 'Allocation',
    entityId: id,
    status: 'Success',
    metadata: { executionTxHash }
  });

  return updated;
};
