import prisma from '../../config/db';
import { EventHandlerContext, UnrecoverableError } from '../types';
import { bytes32ToUuid, dbAmountToWei } from '../../utils/web3-format';

export const handleAllocationProposed = async ({ event, logger }: EventHandlerContext) => {
  const { allocationId, campaignId, amount, payee } = event.payload;
  const uuid = bytes32ToUuid(allocationId);

  const allocation = await prisma.allocation.findUnique({ where: { id: uuid } });
  
  if (!allocation) {
    throw new UnrecoverableError(`Allocation ${uuid} not found. Cannot reconcile AllocationProposed.`);
  }

  // Cross-check payload
  const expectedCampaignId = bytes32ToUuid(campaignId);
  if (allocation.campaignId !== expectedCampaignId) {
    throw new UnrecoverableError(`Allocation ${uuid} campaign mismatch. Expected ${allocation.campaignId}, got ${expectedCampaignId}`);
  }

  // Exact integer comparison using deterministic scaling helper
  const dbAmountWei = dbAmountToWei(allocation.amount);
  if (dbAmountWei.toString() !== amount.toString()) {
    throw new UnrecoverableError(`Allocation ${uuid} amount mismatch. Expected ${dbAmountWei.toString()}, got ${amount.toString()}`);
  }

  // Only transition from DRAFT or if idempotently PENDING_MULTISIG
  if (allocation.status === 'DRAFT') {
    await prisma.allocation.update({
      where: { id: uuid },
      data: { 
        status: 'PENDING_MULTISIG',
        proposalTxHash: event.transactionHash
      }
    });
    logger(`Updated Allocation ${uuid} to PENDING_MULTISIG with proposalTxHash`);

    // M15: Asynchronous Notification trigger
    try {
      const { notifyMultisigSigners } = require('../../services/notification.service');
      notifyMultisigSigners(uuid);
    } catch (e: any) {
      logger(`Failed to trigger Multisig Notifications for ${uuid}: ${e.message}`);
    }
  } else if (allocation.proposalTxHash !== event.transactionHash) {
     // If we see a new proposal tx hash for the same allocation, update it if still pending? 
     // According to idempotency, if it's already past DRAFT, we just ensure proposalTxHash is set.
     if (!allocation.proposalTxHash) {
       await prisma.allocation.update({
         where: { id: uuid },
         data: { proposalTxHash: event.transactionHash }
       });
       logger(`Updated Allocation ${uuid} proposalTxHash`);
     }
  } else {
    logger(`Allocation ${uuid} already PENDING_MULTISIG with this proposalTxHash`);
  }
};

export const handleAllocationApproved = async ({ event, logger }: EventHandlerContext) => {
  const { allocationId, signer } = event.payload;
  const uuid = bytes32ToUuid(allocationId);

  const allocation = await prisma.allocation.findUnique({ where: { id: uuid } });
  
  if (!allocation) {
    throw new UnrecoverableError(`Allocation ${uuid} not found. Cannot reconcile AllocationApproved.`);
  }

  // Idempotently create the MultisigApproval record if it doesn't exist
  let existingApproval = await prisma.multisigApproval.findUnique({
    where: {
      allocationId_signerWallet: {
        allocationId: uuid,
        signerWallet: signer
      }
    }
  });

  if (!existingApproval) {
    existingApproval = await prisma.multisigApproval.create({
      data: {
        allocationId: uuid,
        signerWallet: signer,
        status: 'Signed',
        approvalTxHash: event.transactionHash
      }
    });
    logger(`Created MultisigApproval for Allocation ${uuid} by signer ${signer}`);
  } else {
    logger(`MultisigApproval for Allocation ${uuid} by signer ${signer} already exists.`);
  }

  // Threshold check - 2 distinct signers
  const approvalsCount = await prisma.multisigApproval.count({
    where: {
      allocationId: uuid,
      status: 'Signed'
    }
  });

  if (approvalsCount >= 2 && allocation.status === 'PENDING_MULTISIG') {
    await prisma.allocation.update({
      where: { id: uuid },
      data: { status: 'APPROVED' }
    });
    logger(`Updated Allocation ${uuid} to APPROVED`);
  }
};

export const handleAllocationExecuted = async ({ event, logger }: EventHandlerContext) => {
  const { allocationId, campaignId, amount, payee } = event.payload;
  const uuid = bytes32ToUuid(allocationId);

  const allocation = await prisma.allocation.findUnique({ where: { id: uuid } });
  
  if (!allocation) {
    throw new UnrecoverableError(`Allocation ${uuid} not found. Cannot reconcile AllocationExecuted.`);
  }

  // Cross-check all event fields against DB state
  const expectedCampaignId = bytes32ToUuid(campaignId);
  if (allocation.campaignId !== expectedCampaignId) {
    throw new UnrecoverableError(`Allocation ${uuid} campaign mismatch. Expected ${allocation.campaignId}, got ${expectedCampaignId}`);
  }

  const dbAmountWei = dbAmountToWei(allocation.amount);
  if (dbAmountWei.toString() !== amount.toString()) {
    throw new UnrecoverableError(`Allocation ${uuid} amount mismatch. Expected ${dbAmountWei.toString()}, got ${amount.toString()}`);
  }

  if (allocation.status !== 'CONFIRMED') {
    await prisma.allocation.update({
      where: { id: uuid },
      data: { 
        status: 'CONFIRMED',
        executionTxHash: event.transactionHash
      }
    });
    logger(`Updated Allocation ${uuid} to CONFIRMED`);
  } else {
    logger(`Allocation ${uuid} is already CONFIRMED.`);
  }
};
